<?php
/*
 * Skyline API — the office's mailboxes.
 *
 * The domain's MX points at Resend, so every address @skyline-et.com is
 * received there and posted to /api/resend/webhook. Each message is filed
 * into the mailbox of the address it was sent to — a person's own box
 * (hana@) or a shared one (info@) — and mail for an address nobody has set
 * up goes to the catch-all box rather than being lost.
 *
 * Staff read and send from the boxes that are theirs: their own, and the
 * shared boxes of their role or that name them. An administrator can open
 * every box, but sends only from their own and the shared ones they belong to.
 *
 * Helpers only; the routes are in mailbox.php.
 */

declare(strict_types=1);

/* ---------- addresses ---------- */

function mail_domain(): string {
  $d = strtolower(trim((string)(cfg()['MAIL_DOMAIN'] ?? '')));
  if ($d === '') {
    $from = strtolower((string)(cfg()['MAIL_FROM'] ?? ''));
    $d = str_contains($from, '@') ? substr($from, strrpos($from, '@') + 1) : (parse_url(site_url(), PHP_URL_HOST) ?: 'skyline-et.com');
  }
  return $d;
}

/* the box the website sends its confirmations from and files its notices in */
function website_mailbox(): ?array {
  static $box = false;
  if ($box !== false) return $box;
  try {
    $row = db()->query('SELECT * FROM mailboxes WHERE website = 1 ORDER BY id LIMIT 1')->fetch();
    $box = $row ? mailbox_row($row) : null;
  } catch (Throwable $e) {
    $box = null; // before the upgrade has run
  }
  return $box;
}

function own_address(string $email): bool {
  return str_ends_with(strtolower(trim($email)), '@' . mail_domain());
}

/* "hana" or "Hana@Skyline-ET.com" → hana@skyline-et.com; '' if it cannot be one of ours */
function own_address_from(string $input): string {
  $s = strtolower(trim($input));
  if ($s === '') return '';
  if (!str_contains($s, '@')) $s .= '@' . mail_domain();
  if (!preg_match('/^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?@/', $s) || str_contains($s, '..')) return '';
  return own_address($s) && valid_email($s) ? $s : '';
}

/* MIME encoded-words (=?UTF-8?B?…?=) left in a header, decoded */
function mime_text(string $s): string {
  return str_contains($s, '=?') ? (mb_decode_mimeheader($s) ?: $s) : $s;
}

function parse_address(string $raw): array {
  $raw = trim(mime_text($raw));
  if (preg_match('/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/', $raw, $m)) {
    return ['name' => trim($m[1]), 'email' => strtolower(trim($m[2]))];
  }
  return ['name' => '', 'email' => strtolower($raw)];
}

/* every address in a field that is a string, a list of strings, or a list of {address, name} */
function addresses_of($v): array {
  $items = is_array($v) ? $v : preg_split('/,(?=(?:[^"]*"[^"]*")*[^"]*$)/', (string)$v);
  $out = [];
  foreach ($items as $it) {
    $raw = is_array($it) ? (string)($it['address'] ?? $it['email'] ?? '') : (string)$it;
    $a = parse_address($raw)['email'];
    if ($a !== '' && valid_email($a)) $out[] = $a;
  }
  return array_values(array_unique($out));
}

function address_list($raw): string {
  return mb_substr(implode(', ', addresses_of($raw)), 0, 500);
}

/* what the panel sent in a To or Cc box → valid addresses, at most 20 */
function recipients($raw): array {
  $list = is_array($raw) ? $raw : preg_split('/[,;\s]+/', (string)$raw);
  $out = [];
  foreach ($list as $a) {
    $a = strtolower(trim((string)$a));
    if ($a === '') continue;
    if (!valid_email($a)) fail(400, "\"$a\" is not an email address");
    $out[$a] = true;
  }
  if (count($out) > 20) fail(400, 'Twenty recipients at most');
  return array_keys($out);
}

/* ---------- mailboxes ---------- */

function mailbox_roles($v): array {
  $r = json_col($v);
  return is_array($r) ? array_values(array_intersect(ROLES, $r)) : [];
}

function mailbox_row(array $b): array {
  return [
    'id' => (int)$b['id'],
    'address' => $b['address'],
    'name' => $b['name'],
    'kind' => $b['kind'],
    'owner_id' => $b['owner_id'] !== null ? (int)$b['owner_id'] : null,
    'roles' => mailbox_roles($b['roles']),
    'catch_all' => (bool)$b['catch_all'],
    'website' => (bool)($b['website'] ?? false),
  ];
}

/* Every mailbox this person may open. `member`: theirs to read and send
   from. An administrator also gets everyone else's, with member = false. */
function user_mailboxes(array $u): array {
  $st = db()->prepare('SELECT mailbox_id FROM mailbox_members WHERE user_id = ?');
  $st->execute([$u['id']]);
  $listed = array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
  $system = strtolower(mail_from()[0]);
  $out = [];
  foreach (db()->query('SELECT * FROM mailboxes') as $row) {
    $b = mailbox_row($row);
    $own = $b['kind'] === 'personal' && $b['owner_id'] === $u['id'];
    $member = $own || ($b['kind'] === 'shared' && (in_array($u['role'], $b['roles'], true) || in_array($b['id'], $listed, true)));
    if (!$member && $u['role'] !== 'admin') continue;
    $b['own'] = $own;
    $b['member'] = $member;
    $b['system'] = $b['website'] || $b['address'] === $system;
    $out[] = $b;
  }
  // their own first, then the shared boxes they read, then (admins) everyone else's
  usort($out, fn ($a, $b) => [!$a['own'], !$a['member'], $a['kind'] !== 'shared', $a['address']]
    <=> [!$b['own'], !$b['member'], $b['kind'] !== 'shared', $b['address']]);
  return $out;
}

function mailbox_find(array $u, int $id): ?array {
  foreach (user_mailboxes($u) as $b) if ($b['id'] === $id) return $b;
  return null;
}

function mailbox_by_address(string $address): ?array {
  $st = db()->prepare('SELECT * FROM mailboxes WHERE address = ?');
  $st->execute([strtolower(trim($address))]);
  $b = $st->fetch();
  return $b ? mailbox_row($b) : null;
}

function catch_all_mailbox(): ?array {
  $b = db()->query("SELECT * FROM mailboxes ORDER BY catch_all DESC, kind = 'shared' DESC, id LIMIT 1")->fetch();
  return $b ? mailbox_row($b) : null;
}

/* unread in each of these boxes: [id => n] */
function mailbox_unread(array $ids): array {
  $ids = array_values(array_filter(array_map('intval', $ids)));
  if (!$ids) return [];
  $in = implode(',', $ids);
  $out = [];
  foreach (db()->query("SELECT mailbox_id, COUNT(*) AS n FROM inbox_messages WHERE direction = 'in' AND status = 'unread' AND mailbox_id IN ($in) GROUP BY mailbox_id") as $r) {
    $out[(int)$r['mailbox_id']] = (int)$r['n'];
  }
  return $out;
}

/* A person's own box at their sign-in address, made along with the account.
   An address that is already a box (a shared one) is left as it is. */
function ensure_personal_mailbox(int $userId): ?int {
  $st = db()->prepare('SELECT id, email, name FROM users WHERE id = ?');
  $st->execute([$userId]);
  $u = $st->fetch();
  if (!$u || !own_address((string)$u['email'])) return null;
  if ($box = mailbox_by_address((string)$u['email'])) return $box['id'];
  $local = (string)strstr((string)$u['email'], '@', true);
  db()->prepare("INSERT INTO mailboxes (address, name, kind, owner_id) VALUES (?, ?, 'personal', ?)")
    ->execute([strtolower((string)$u['email']), $u['name'] ?: ucfirst($local), $userId]);
  return (int)db()->lastInsertId();
}

/* the message, if this person may see it — otherwise a 404 that says nothing */
function message_for(array $u, int $id): array {
  $st = db()->prepare('SELECT * FROM inbox_messages WHERE id = ?');
  $st->execute([$id]);
  $m = $st->fetch();
  if (!$m) fail(404, 'Message not found');
  if ($m['mailbox_id'] === null) {
    if ($u['role'] !== 'admin') fail(404, 'Message not found');
    $m['box'] = null;
  } else {
    $m['box'] = mailbox_find($u, (int)$m['mailbox_id']);
    if (!$m['box']) fail(404, 'Message not found');
  }
  return $m;
}

/* the signature a person's messages start with; a sensible one until they write their own */
function user_signature(array $u): string {
  $st = db()->prepare('SELECT name, signature FROM users WHERE id = ?');
  $st->execute([$u['id']]);
  $row = $st->fetch() ?: [];
  if (trim((string)($row['signature'] ?? '')) !== '') return (string)$row['signature'];
  $b = brand();
  $host = parse_url(site_url(), PHP_URL_HOST) ?: mail_domain();
  return trim(($row['name'] ?? '') . "\nSkyline Travel Solution\n{$b['address']}, {$b['landmark']}\nWhatsApp {$b['whatsapp']} · $host");
}

/* ---------- conversations ---------- */

/* A conversation is a subject with one correspondent, so two applicants who
   both answer "Your application" never land in each other's thread. */
function subject_thread(string $subject, string $counterpart): string {
  $norm = strtolower(trim(preg_replace('/^\s*((re|fwd?|aw|sv)\s*:\s*)+/i', '', $subject)));
  return substr('s_' . sha1($norm . '|' . strtolower(trim($counterpart))), 0, 40);
}

/* the thread a reply belongs to, by the Message-IDs it answers; else by subject */
function resolve_thread(?int $boxId, string $subject, array $refs, string $counterpart): string {
  $refs = array_values(array_unique(array_filter(array_map(fn ($r) => trim((string)$r, " <>\t\r\n"), $refs))));
  if ($refs) {
    $in = implode(',', array_fill(0, count($refs), '?'));
    $st = db()->prepare("SELECT thread_key FROM inbox_messages WHERE mailbox_id <=> ? AND message_id IN ($in) ORDER BY id DESC LIMIT 1");
    $st->execute(array_merge([$boxId], $refs));
    $k = $st->fetchColumn();
    if ($k) return (string)$k;
  }
  return subject_thread($subject, $counterpart);
}

function office_time(string $ts): string {
  $tz = new DateTimeZone((string)(cfg()['OFFICE_TIMEZONE'] ?? 'Africa/Addis_Ababa'));
  return (new DateTime($ts, new DateTimeZone('UTC')))->setTimezone($tz)->format('D, j M Y \a\t H:i');
}

function sender_line(array $m): string {
  return $m['from_name'] ? "{$m['from_name']} <{$m['from_email']}>" : (string)$m['from_email'];
}

/* the message being answered, quoted under the reply the way mail clients do */
function quote_block(array $m): string {
  $lines = array_slice(preg_split('/\r?\n/', rtrim((string)$m['text_body'])), 0, 150);
  return "\n\nOn " . office_time((string)$m['created_at']) . ', ' . sender_line($m) . " wrote:\n"
    . implode("\n", array_map(fn ($l) => '> ' . $l, $lines));
}

function forward_block(array $m): string {
  return "\n\n---------- Forwarded message ----------\n"
    . 'From: ' . sender_line($m) . "\n"
    . 'Date: ' . office_time((string)$m['created_at']) . "\n"
    . "Subject: {$m['subject']}\n"
    . 'To: ' . ($m['to_email'] ?: '—') . "\n\n"
    . rtrim((string)$m['text_body']);
}

function html_to_text(string $html): string {
  $s = preg_replace('#<(script|style|head)\b[^>]*>.*?</\1>#is', '', $html);
  $s = preg_replace('#<br\s*/?>#i', "\n", $s);
  $s = preg_replace('#</(p|div|tr|li|h[1-6]|blockquote)>#i', "\n\n", $s);
  $s = trim(html_entity_decode(strip_tags($s), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
  return preg_replace("/\n{3,}/", "\n\n", preg_replace('/[ \t]+\n/', "\n", $s));
}

/* Received HTML, made inert for the reader: the panel shows it in a sandboxed
   frame with no scripts and no remote loads, and this strips what a sandbox
   would still let through (refresh redirects, forms, embedded documents). */
function clean_mail_html(string $html): string {
  if (preg_match('#^data:text/html[^,]*,#i', $html, $m)) {
    $data = substr($html, strlen($m[0]));
    $html = str_contains($m[0], ';base64') ? (string)base64_decode($data) : rawurldecode($data);
  }
  $html = preg_replace('#<(script|iframe|object|embed|applet|form|frameset|frame)\b[^>]*>.*?</\1\s*>#is', '', $html);
  $html = preg_replace('#<(script|iframe|object|embed|applet|form|input|button|textarea|select|meta|link|base|frame)\b[^>]*>#i', '', $html);
  $html = preg_replace('#\son[a-z]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)#i', '', $html);
  $html = preg_replace('#(href|src)\s*=\s*(["\']?)\s*(javascript|vbscript|data:text/html)[^"\'\s>]*\2#i', '$1="#"', $html);
  return $html;
}

/* ---------- incoming ---------- */

function resend_api_get(string $path): ?array {
  $key = cfg()['RESEND_API_KEY'] ?? '';
  if ($key === '') return null;
  $ch = curl_init('https://api.resend.com' . $path);
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer $key"]]);
  $raw = curl_exec($ch);
  $ok = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE) < 300;
  curl_close($ch);
  return $ok ? (json_decode($raw ?: '', true) ?: null) : null;
}

/* attachments land OUTSIDE the web root and are only served through an
   authenticated endpoint — people send passports and bank statements */
function mail_attachment_dir(): string { return private_dir('mail-attachments'); }

function store_attachments(array $attachments, string $emailId): array {
  $out = [];
  $dir = mail_attachment_dir();
  $key = cfg()['RESEND_API_KEY'] ?? '';
  foreach ($attachments as $att) {
    try {
      $bytes = null;
      if (!empty($att['content'])) {
        $bytes = base64_decode((string)$att['content'], true) ?: null;
      } else {
        /* the listing carries only metadata — ask for a short-lived signed link, then pull the bytes */
        $url = (string)($att['download_url'] ?? '');
        if ($url === '' && !empty($att['id']) && $emailId !== '' && $key !== '') {
          $meta = resend_api_get('/emails/receiving/' . rawurlencode($emailId) . '/attachments/' . rawurlencode((string)$att['id']));
          $url = (string)($meta['download_url'] ?? '');
        }
        if ($url !== '') {
          $ch = curl_init($url);
          curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60, CURLOPT_FOLLOWLOCATION => true]);
          $body = curl_exec($ch);
          $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
          curl_close($ch);
          if ($body !== false && $code < 300) $bytes = $body;
        }
      }
      if ($bytes === null || $bytes === '' || strlen($bytes) > 25 * 1024 * 1024) continue;
      $name = preg_replace('/[^A-Za-z0-9._-]/', '_', (string)($att['filename'] ?? 'attachment'));
      $id = bin2hex(random_bytes(8));
      file_put_contents("$dir/{$id}_{$name}", $bytes);
      $out[] = [
        'id' => $id,
        'filename' => mb_substr((string)($att['filename'] ?? $name), 0, 190),
        'stored' => "{$id}_{$name}",
        'content_type' => (string)($att['content_type'] ?? $att['contentType'] ?? 'application/octet-stream'),
        'size' => strlen($bytes),
        'cid' => isset($att['content_id']) ? trim((string)$att['content_id'], '<>') : null,
      ];
    } catch (Throwable $e) {
      error_log('Skyline mail: attachment failed — ' . $e->getMessage()); // one bad file must not lose the message
    }
  }
  return $out;
}

/* A message Resend received for the domain, filed into every box it was
   addressed to — or the catch-all, when none of them exist. */
function store_inbound(array $d): void {
  $emailId = (string)($d['email_id'] ?? $d['id'] ?? '');
  $full = $emailId !== '' ? resend_api_get('/emails/receiving/' . rawurlencode($emailId)) : null;
  $e = array_merge($d, array_filter($full ?: [], fn ($v) => $v !== null));
  $headers = is_array($e['headers'] ?? null) ? array_change_key_case($e['headers'], CASE_LOWER) : [];

  /* the envelope first — it also names the Bcc'd — then the headers */
  $rcpt = [];
  foreach (['received_for', 'to', 'cc', 'bcc'] as $k) array_push($rcpt, ...addresses_of($e[$k] ?? []));
  $boxes = [];
  foreach (array_unique($rcpt) as $a) {
    if (own_address($a) && ($b = mailbox_by_address($a))) $boxes[$b['id']] = $b;
  }
  if (!$boxes && ($c = catch_all_mailbox())) $boxes[$c['id']] = $c;
  if (!$boxes) $boxes = [0 => null]; // no boxes set up at all: kept for an administrator

  $todo = [];
  foreach ($boxes as $b) {
    $bid = $b ? $b['id'] : null;
    if ($emailId !== '') {
      $st = db()->prepare('SELECT 1 FROM inbox_messages WHERE resend_id = ? AND mailbox_id <=> ?');
      $st->execute([$emailId, $bid]);
      if ($st->fetchColumn()) continue; // Resend retries a webhook — file each copy once
    }
    $todo[] = $bid;
  }
  if (!$todo) return;

  $from = parse_address((string)($headers['from'] ?? ''));
  if (!valid_email($from['email'])) {
    $from = parse_address(is_array($e['from'] ?? null) ? (string)($e['from']['address'] ?? '') : (string)($e['from'] ?? ''));
  }
  $subject = mime_text(trim((string)($e['subject'] ?? ''))) ?: '(no subject)';
  $html = clean_mail_html((string)($e['html'] ?? ''));
  $text = trim((string)($e['text'] ?? ''));
  if ($text === '' && $html !== '') $text = html_to_text($html);
  $messageId = trim((string)($e['message_id'] ?? $headers['message-id'] ?? ''), " <>\t");
  $inReplyTo = trim((string)($headers['in-reply-to'] ?? ''), " <>\t");
  $refs = preg_match_all('/<([^>]+)>/', (string)($headers['references'] ?? ''), $mm) ? $mm[1] : [];
  $replyTo = addresses_of($e['reply_to'] ?? ($headers['reply-to'] ?? ''))[0] ?? '';

  $verdict = fn ($h) => strtoupper(trim((string)($headers[$h] ?? '')));
  $virus = $verdict('x-ses-virus-verdict') === 'FAIL';
  $auth = [];
  foreach (['spf', 'dkim', 'dmarc'] as $k) {
    if (isset($e['authentication'][$k])) $auth[] = $k . '=' . preg_replace('/[^a-z]/', '', strtolower((string)$e['authentication'][$k]));
  }
  $auth = implode(' ', $auth);
  /* mail that claims to be from our own domain and fails DMARC is a forgery —
     exactly what a "reset your password" phish would look like */
  $forged = own_address($from['email']) && str_contains($auth, 'dmarc=fail');
  $spam = $virus || $forged || $verdict('x-ses-spam-verdict') === 'FAIL';
  $attachments = $virus ? [] : store_attachments($e['attachments'] ?? [], $emailId);

  $ins = db()->prepare('INSERT INTO inbox_messages (mailbox_id, resend_id, message_id, thread_key, direction, from_email, from_name, to_email, cc_email, reply_to, subject, text_body, html_body, attachments, in_reply_to, auth, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  foreach ($todo as $bid) {
    $ins->execute([
      $bid, $emailId ?: null, $messageId !== '' ? mb_substr($messageId, 0, 190) : null,
      resolve_thread($bid, $subject, array_merge([$inReplyTo], $refs), $from['email']), 'in',
      mb_substr($from['email'], 0, 190), mb_substr(mime_text($from['name']), 0, 190) ?: null,
      address_list($e['to'] ?? ''), address_list($e['cc'] ?? '') ?: null, $replyTo !== '' ? mb_substr($replyTo, 0, 190) : null,
      mb_substr($subject, 0, 255), $text, $html !== '' ? $html : null,
      $attachments ? json_encode($attachments, JSON_UNESCAPED_UNICODE) : null,
      $inReplyTo !== '' ? mb_substr($inReplyTo, 0, 190) : null, $auth ?: null, $spam ? 'spam' : 'unread',
    ]);
  }
}

/* Something the system files straight into one of our own boxes — the
   website's form notices — with no round trip through the mail servers. */
function deliver_local(array $box, array $m): void {
  db()->prepare('INSERT INTO inbox_messages (mailbox_id, thread_key, direction, from_email, from_name, to_email, reply_to, subject, text_body, source, submission_id, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    ->execute([
      $box['id'], subject_thread($m['subject'], $m['from_email']), 'in',
      mb_substr($m['from_email'], 0, 190), mb_substr((string)($m['from_name'] ?? ''), 0, 190) ?: null,
      $box['address'], ($m['reply_to'] ?? '') ?: null, mb_substr($m['subject'], 0, 255), $m['text'],
      $m['source'] ?? null, $m['submission_id'] ?? null, 'unread',
    ]);
}

/* ---------- outgoing ---------- */

/* what the panel staged → [files for the mailer, metadata for the Sent copy] */
function outbound_attachments($list): array {
  $files = [];
  $meta = [];
  foreach (is_array($list) ? $list : [] as $a) {
    if (!preg_match('/^[0-9a-f]{16}$/', (string)($a['id'] ?? ''))) continue;
    $file = mail_attachment_dir() . '/' . basename((string)($a['stored'] ?? ''));
    if (!is_file($file) || !str_starts_with(basename($file), $a['id'] . '_')) continue;
    $name = (string)($a['filename'] ?? basename($file));
    $files[] = ['path' => $file, 'filename' => $name];
    $meta[] = [
      'id' => $a['id'], 'filename' => $name, 'size' => (int)filesize($file),
      'content_type' => (string)($a['content_type'] ?? 'application/octet-stream'),
      'stored' => basename($file),
    ];
  }
  return [$files, $meta];
}

/* A delivery report for something sent from a mailbox: shown on the Sent
   copy, and the Message-ID the provider gave it is kept so the recipient's
   answer finds its way back into the same conversation. */
function track_delivery(string $resendId, string $status, array $data): void {
  $sql = $status === 'opened'
    ? "UPDATE inbox_messages SET delivery = ? WHERE resend_id = ? AND direction = 'out' AND (delivery IS NULL OR delivery IN ('sent','delivered'))"
    : "UPDATE inbox_messages SET delivery = ? WHERE resend_id = ? AND direction = 'out'";
  db()->prepare($sql)->execute([$status, $resendId]);

  $st = db()->prepare("SELECT COUNT(*) FROM inbox_messages WHERE resend_id = ? AND direction = 'out' AND message_id IS NULL");
  $st->execute([$resendId]);
  if (!(int)$st->fetchColumn()) return;
  $mid = trim((string)($data['message_id'] ?? (resend_api_get('/emails/' . rawurlencode($resendId))['message_id'] ?? '')), " <>\t");
  if ($mid !== '') {
    db()->prepare("UPDATE inbox_messages SET message_id = ? WHERE resend_id = ? AND direction = 'out' AND message_id IS NULL")
      ->execute([mb_substr($mid, 0, 190), $resendId]);
  }
}
