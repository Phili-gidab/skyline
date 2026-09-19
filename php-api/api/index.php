<?php
/*
 * Skyline API — front controller.
 *
 * Adapted from the RTG API (the rtgeth project): the same single-file router
 * and content model, with payments removed and three website forms, staff
 * roles and password-reset links added. Routed here by public_html/.htaccess:
 *   RewriteRule ^api(/.*)?$ api/index.php
 */

declare(strict_types=1);
require __DIR__ . '/lib.php';

error_reporting(E_ALL);
ini_set('display_errors', '0');

set_exception_handler(function (Throwable $e) {
  error_log('Skyline API: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
  send(500, ['error' => 'Internal server error']);
});

apply_cors();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = preg_replace('#^/api#', '', $path) ?: '/';
$path = rtrim($path, '/') ?: '/';

/* The three website forms. `extra` fields are the only ones kept beyond the
   basics, each with the label the office sees in the notice email. */
const FORMS = [
  'enquiry' => [
    'label' => 'Visa enquiry',
    'extra' => ['destination' => 'Destination', 'visa' => 'Visa type'],
    'email_required' => false,
  ],
  'study' => [
    'label' => 'Study application',
    'extra' => ['programme' => 'Programme', 'education' => 'Education', 'gpa' => 'GPA', 'intake' => 'Intake'],
    'email_required' => true,
  ],
  'career' => [
    'label' => 'Job application',
    'extra' => ['role' => 'Position'],
    'email_required' => true,
  ],
];

/* ============================================================
   PUBLIC
   ============================================================ */

if ($method === 'GET' && $path === '/health') {
  send(200, ['ok' => true, 'ts' => (int)(microtime(true) * 1000)]);
}

/* One-time install from the browser, for hosting without SSH: creates the
   tables, the first admin and the default content. Off unless SETUP_TOKEN
   is set in the config — and it should be cleared again afterwards. */
if ($method === 'POST' && $path === '/setup') {
  $token = (string)(cfg()['SETUP_TOKEN'] ?? '');
  if ($token === '') fail(404, 'Not found');
  rate_limit('setup', 600, 10);
  $given = (string)($_SERVER['HTTP_X_SETUP_TOKEN'] ?? (body_json()['token'] ?? ''));
  if (!hash_equals($token, $given)) fail(403, 'Wrong setup token');
  require __DIR__ . '/setup.php';
  send(200, ['ok' => true, 'log' => run_setup(db(), cfg())]);
}

if ($method === 'POST' && $path === '/auth/login') {
  rate_limit('login', 300, 10);
  $b = body_json();
  $email = strtolower(clean($b['email'] ?? '', 190));
  $password = (string)($b['password'] ?? '');
  if ($email === '' || $password === '') fail(400, 'Email and password are required');
  $st = db()->prepare('SELECT * FROM users WHERE email = ? AND is_disabled = 0');
  $st->execute([$email]);
  $user = $st->fetch();
  if (!$user || !password_verify($password, str_replace('$2a$', '$2y$', $user['password_hash']))) {
    fail(401, 'Email or password is incorrect');
  }
  db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$user['id']]);
  send(200, [
    'token' => jwt_sign($user),
    'user' => ['email' => $user['email'], 'name' => $user['name'], 'role' => $user['role']],
  ]);
}

/* Forgot password: always the same answer, so the form cannot be used to
   discover which addresses have accounts. */
if ($method === 'POST' && $path === '/auth/forgot') {
  rate_limit('forgot', 900, 5);
  $email = strtolower(clean(body_json()['email'] ?? '', 190));
  if (valid_email($email)) {
    $st = db()->prepare('SELECT id, email, name FROM users WHERE email = ? AND is_disabled = 0');
    $st->execute([$email]);
    if ($user = $st->fetch()) send_reset_link($user, 3600, false);
  }
  send(200, ['ok' => true]);
}

if ($method === 'POST' && $path === '/auth/reset') {
  rate_limit('reset', 900, 10);
  $b = body_json();
  $token = (string)($b['token'] ?? '');
  $password = (string)($b['password'] ?? '');
  if (!preg_match('/^[a-f0-9]{64}$/', $token)) fail(400, 'This link is not valid');
  if (strlen($password) < 10) fail(400, 'Choose a password of at least 10 characters');
  $st = db()->prepare('SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()');
  $st->execute([hash('sha256', $token)]);
  $reset = $st->fetch();
  if (!$reset) fail(400, 'This link has expired or was already used — ask for a new one');
  db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([hash_password($password), $reset['user_id']]);
  db()->prepare('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL')->execute([$reset['user_id']]);
  send(200, ['ok' => true]);
}

/* a one-time link to set a password — for a forgotten one, or a new colleague */
function send_reset_link(array $user, int $ttl, bool $invite): void {
  $token = bin2hex(random_bytes(32));
  db()->prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))')
    ->execute([(int)$user['id'], hash('sha256', $token), $ttl]);
  $link = site_url('/admin/reset?token=' . $token);
  $who = $user['name'] ?: $user['email'];
  if ($invite) {
    send_mail(
      $user['email'],
      'Your Skyline admin account',
      "Hello $who,\n\nAn account has been created for you on the Skyline Travel Solution website admin.\n\n"
      . "Choose your password here (the link works for " . round($ttl / 3600) . " hours):\n$link\n\n"
      . "Then sign in at " . site_url('/admin') . " with this email address.\n\nSkyline Travel Solution"
    );
  } else {
    send_mail(
      $user['email'],
      'Reset your Skyline admin password',
      "Hello $who,\n\nSomeone — hopefully you — asked to reset the password for this admin account.\n\n"
      . "Choose a new password here (the link works for one hour, once):\n$link\n\n"
      . "If you did not ask for this, ignore this email; your password has not changed.\n\nSkyline Travel Solution"
    );
  }
}

if ($method === 'GET' && $path === '/content') {
  $out = ['singles' => (object)[], 'collections' => (object)[]];
  $singles = [];
  foreach (db()->query('SELECT k, data FROM content') as $row) $singles[$row['k']] = json_col($row['data']);
  $collections = [];
  foreach (db()->query('SELECT id, collection, data FROM items WHERE published = 1 ORDER BY collection, sort, id') as $row) {
    $collections[$row['collection']][] = array_merge(['id' => (int)$row['id']], json_col($row['data']) ?: []);
  }
  if ($singles) $out['singles'] = $singles;
  if ($collections) $out['collections'] = $collections;
  // edits should show on the next page load, so the browser revalidates every time
  send(200, $out, ['Cache-Control' => 'no-cache']);
}

/* ---------- the website forms ----------
   Stored first, then mailed: the office gets a notice (Reply-To the sender,
   so they can just press Reply), and the sender gets a confirmation. If the
   mail fails, the submission is still safe in the admin. */

function cv_dir(): string { return private_dir('cv'); }

/* PDF or Word only. finfo reports a .docx as a zip on some hosts, so a zip
   that carries the Word document structure is accepted as one. */
function accept_cv(array $f): array {
  if ($f['error'] === UPLOAD_ERR_NO_FILE) fail(400, 'Please attach your CV');
  if ($f['error'] !== UPLOAD_ERR_OK) fail(400, 'Your CV did not upload — please try a smaller file');
  if ($f['size'] > 5 * 1024 * 1024) fail(400, 'Your CV is larger than 5 MB — please send a smaller file');
  $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']) ?: '';
  $ext = strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION));
  $types = [
    'application/pdf' => 'pdf',
    'application/msword' => 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
  ];
  $kind = $types[$mime] ?? null;
  if (!$kind && $ext === 'docx' && in_array($mime, ['application/zip', 'application/octet-stream'], true)) {
    $zip = (string)file_get_contents($f['tmp_name'], false, null, 0, 4096);
    if (str_starts_with($zip, "PK") && str_contains($zip, 'word/')) $kind = 'docx';
  }
  if (!$kind) fail(400, 'Please attach your CV as a PDF or a Word document');
  $stored = gmdate('Ymd') . '-' . bin2hex(random_bytes(8)) . ".$kind";
  if (!move_uploaded_file($f['tmp_name'], cv_dir() . "/$stored")) fail(500, 'Could not store your CV — please try again');
  $name = preg_replace('/[^A-Za-z0-9._ -]/', '_', basename((string)$f['name'])) ?: "cv.$kind";
  return ['stored' => $stored, 'filename' => mb_substr($name, 0, 120), 'size' => (int)$f['size'], 'type' => $mime];
}

if ($method === 'POST' && $path === '/submit') {
  rate_limit('submit', 60, 6);
  $multipart = str_starts_with((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'multipart/form-data');
  $b = $multipart ? $_POST : body_json();
  if (!empty($b['website'])) send(201, ['ok' => true]); // honeypot: real people never fill "website"

  $kind = (string)($b['kind'] ?? '');
  if (!isset(FORMS[$kind])) fail(400, 'Unknown form');
  $form = FORMS[$kind];

  $name = clean($b['name'] ?? '', 190);
  if ($name === '') fail(400, 'Please tell us your name');
  $phone = clean($b['phone'] ?? '', 64);
  if ($phone === '') fail(400, 'Please give us a phone number');
  $email = strtolower(clean($b['email'] ?? '', 190));
  if ($email !== '' && !valid_email($email)) fail(400, 'That email address does not look right');
  if ($form['email_required'] && $email === '') fail(400, 'Please give us your email address');
  $message = clean($b['message'] ?? '', 5000);

  $extra = [];
  foreach ($form['extra'] as $key => $_) {
    $v = clean($b[$key] ?? '', 190);
    if ($v !== '') $extra[$key] = $v;
  }
  $cv = null;
  if ($kind === 'career') {
    $cv = accept_cv($_FILES['cv'] ?? ['error' => UPLOAD_ERR_NO_FILE]);
    $extra['cv'] = $cv;
  }

  db()->prepare('INSERT INTO submissions (kind, name, email, phone, message, extra) VALUES (?,?,?,?,?,?)')
    ->execute([$kind, $name, $email ?: null, $phone, $message ?: null, $extra ? json_encode($extra, JSON_UNESCAPED_UNICODE) : null]);

  /* the office notice */
  $lines = "Name:        $name\nPhone:       $phone\nEmail:       " . ($email ?: '—') . "\n";
  foreach ($form['extra'] as $key => $label) {
    if (isset($extra[$key])) $lines .= str_pad("$label:", 13) . $extra[$key] . "\n";
  }
  if ($cv) $lines .= "CV:          {$cv['filename']} (attached)\n";
  notify(
    "{$form['label']} — $name",
    "A new {$form['label']} arrived through the website.\n\n$lines\n"
    . 'Message:' . "\n" . ($message ?: '—') . "\n\n"
    . ($email ? 'Reply to this email to answer them directly, or ' : 'Call them back, or ')
    . 'open it in the admin: ' . site_url('/admin/submissions'),
    $email,
    $cv ? ['attachments' => [['path' => cv_dir() . '/' . $cv['stored'], 'filename' => $cv['filename']]]] : []
  );

  /* the confirmation — the office still answers personally; this only says it arrived */
  if ($email !== '') {
    $b2 = brand();
    $sign = "\n\nSkyline Travel Solution\n{$b2['address']}, {$b2['landmark']}\nWhatsApp {$b2['whatsapp']}\n" . site_url();
    $ack = match ($kind) {
      'enquiry' => [
        'We received your enquiry — Skyline Travel Solution',
        "Dear $name,\n\nThank you for contacting Skyline Travel Solution"
        . (isset($extra['destination']) ? " about {$extra['destination']}" : '')
        . ". Your enquiry has reached our office, and a consultant will call or write to you shortly — usually within one working day.\n\n"
        . "If it is urgent, message us on WhatsApp on {$b2['whatsapp']}.\n\nNothing is payable until your visa is approved.",
      ],
      'study' => [
        'We received your study application — Skyline Travel Solution',
        "Dear $name,\n\nThank you for applying"
        . (isset($extra['programme']) ? " for {$extra['programme']}" : '')
        . ". A study-abroad consultant will review your details and contact you about the next steps: your eligibility, the admission file and the scholarship.\n\n"
        . "Keep your transcripts and passport to hand — we will ask for copies when we build your file.",
      ],
      'career' => [
        'We received your application — Skyline Travel Solution',
        "Dear $name,\n\nThank you for applying"
        . (isset($extra['role']) ? " for the {$extra['role']} position" : '')
        . " at Skyline Travel Solution. We have your application and your CV.\n\n"
        . "If your profile matches what we are looking for, we will contact you to arrange an interview.",
      ],
    };
    send_mail($email, $ack[0], $ack[1] . $sign, cfg()['NOTIFY_EMAIL'] ?? '');
  }

  send(201, ['ok' => true]);
}

/* ---------- delivery events and incoming mail from Resend (Svix-signed) ---------- */

function parse_address(string $raw): array {
  $raw = trim($raw);
  if (preg_match('/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/', $raw, $m)) {
    return ['name' => trim($m[1]), 'email' => strtolower(trim($m[2]))];
  }
  return ['name' => '', 'email' => strtolower($raw)];
}

function address_list($raw): string {
  if (is_array($raw)) $raw = implode(', ', array_map(fn ($t) => is_array($t) ? ($t['address'] ?? '') : (string)$t, $raw));
  return mb_substr(trim((string)$raw), 0, 190);
}

/* replies stay in their thread; a fresh subject starts one */
function thread_key(string $subject, string $inReplyTo = ''): string {
  if ($inReplyTo !== '') return substr('r_' . sha1($inReplyTo), 0, 40);
  $norm = strtolower(trim(preg_replace('/^\s*(re|fwd|fw)\s*:\s*/i', '', $subject)));
  return substr('s_' . sha1($norm), 0, 40);
}

function html_to_text(string $html): string {
  $s = preg_replace('#<(script|style)\b[^>]*>.*?</\1>#is', '', $html);
  $s = preg_replace('#<br\s*/?>#i', "\n", $s);
  $s = preg_replace('#</(p|div|tr|h[1-6])>#i', "\n\n", $s);
  return trim(html_entity_decode(strip_tags($s), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
}

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
      ];
    } catch (Throwable $e) {
      error_log('Skyline mail: attachment failed — ' . $e->getMessage()); // one bad file must not lose the message
    }
  }
  return $out;
}

function store_inbound(array $d): void {
  $emailId = (string)($d['email_id'] ?? $d['id'] ?? '');
  $full = $emailId !== '' ? resend_api_get('/emails/receiving/' . rawurlencode($emailId)) : null;

  $messageId = $emailId ?: (string)($d['message_id'] ?? bin2hex(random_bytes(8)));
  $st = db()->prepare('SELECT id FROM inbox_messages WHERE message_id = ?');
  $st->execute([$messageId]);
  if ($st->fetchColumn()) return; // Resend retries — store once

  $from = parse_address(is_array($d['from'] ?? null) ? ($d['from']['address'] ?? '') : (string)($d['from'] ?? ''));
  $subject = (string)($d['subject'] ?? '(no subject)');
  $html = (string)($full['html'] ?? $d['html'] ?? '');
  $text = (string)($full['text'] ?? $d['text'] ?? '');
  if ($text === '' && $html !== '') $text = html_to_text($html);
  $headers = $d['headers'] ?? [];
  $inReplyTo = is_array($headers) ? (string)($headers['in-reply-to'] ?? $headers['In-Reply-To'] ?? '') : '';
  $attachments = store_attachments($full['attachments'] ?? ($d['attachments'] ?? []), $emailId);

  db()->prepare('INSERT INTO inbox_messages (resend_id, message_id, thread_key, direction, from_email, from_name, to_email, cc_email, subject, text_body, html_body, attachments, in_reply_to, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    ->execute([
      $emailId ?: null, $messageId, thread_key($subject, $inReplyTo), 'in',
      mb_substr($from['email'], 0, 190), mb_substr($from['name'], 0, 190) ?: null,
      address_list($d['to'] ?? ''), address_list($d['cc'] ?? '') ?: null,
      mb_substr($subject, 0, 255), $text, $html ?: null,
      $attachments ? json_encode($attachments, JSON_UNESCAPED_UNICODE) : null,
      mb_substr($inReplyTo, 0, 190) ?: null, 'unread',
    ]);
  /* deliberately no notify(): the office address may be this very mailbox */
}

if ($method === 'POST' && $path === '/resend/webhook') {
  $raw = file_get_contents('php://input') ?: '';
  if ($raw === '') fail(400, 'Empty payload');

  /* Unlike the RTG original, an unsigned webhook is never accepted: without
     the secret anyone could post messages straight into the office inbox. */
  $secret = (string)(cfg()['RESEND_WEBHOOK_SECRET'] ?? '');
  if ($secret === '') fail(503, 'Webhook not configured');
  $id = $_SERVER['HTTP_SVIX_ID'] ?? '';
  $ts = $_SERVER['HTTP_SVIX_TIMESTAMP'] ?? '';
  $sigHeader = $_SERVER['HTTP_SVIX_SIGNATURE'] ?? '';
  $key = base64_decode(preg_replace('/^whsec_/', '', $secret)) ?: '';
  $expected = base64_encode(hash_hmac('sha256', "$id.$ts.$raw", $key, true));
  $match = false;
  foreach (explode(' ', $sigHeader) as $part) {
    $v = explode(',', $part, 2)[1] ?? '';
    if ($v !== '' && hash_equals($expected, $v)) { $match = true; break; }
  }
  if (!$match || abs(time() - (int)$ts) > 300) fail(401, 'Invalid signature');

  $event = json_decode($raw, true);
  $type = $event['type'] ?? '';
  $emailId = $event['data']['email_id'] ?? ($event['data']['id'] ?? '');

  if ($type === 'email.received' && !empty($event['data'])) {
    store_inbound($event['data']);
    send(200, ['received' => true]);
  }
  $statusMap = [
    'email.delivered' => 'delivered',
    'email.bounced' => 'bounced',
    'email.complained' => 'complained',
    'email.delivery_delayed' => 'delayed',
    'email.opened' => 'opened',
  ];
  if ($emailId && isset($statusMap[$type])) {
    /* a late "opened" must never overwrite a bounce */
    $sql = $statusMap[$type] === 'opened'
      ? "UPDATE email_log SET status = ? WHERE provider_id = ? AND status IN ('sent', 'delivered')"
      : 'UPDATE email_log SET status = ? WHERE provider_id = ?';
    db()->prepare($sql)->execute([$statusMap[$type], $emailId]);
  }
  send(200, ['received' => true]);
}

/* ============================================================
   STAFF (admin + editor)
   ============================================================ */

if ($method === 'GET' && $path === '/auth/me') {
  $u = require_staff();
  send(200, ['email' => $u['email'], 'name' => $u['name'], 'role' => $u['role']]);
}

if ($method === 'POST' && $path === '/auth/password') {
  $u = require_staff();
  rate_limit('pwchange', 300, 5);
  $b = body_json();
  $current = (string)($b['current'] ?? '');
  $new = (string)($b['new'] ?? '');
  if (strlen($new) < 10) fail(400, 'The new password must be at least 10 characters');
  $st = db()->prepare('SELECT password_hash FROM users WHERE id = ?');
  $st->execute([$u['id']]);
  if (!password_verify($current, str_replace('$2a$', '$2y$', (string)$st->fetchColumn()))) {
    fail(400, 'The current password is not right');
  }
  db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([hash_password($new), $u['id']]);
  send(200, ['ok' => true]);
}

if ($method === 'GET' && $path === '/admin/overview') {
  require_staff();
  $forms = [];
  foreach (db()->query('SELECT kind, COUNT(*) AS total, SUM(is_read = 0) AS unread FROM submissions GROUP BY kind') as $r) {
    $forms[$r['kind']] = ['total' => (int)$r['total'], 'unread' => (int)$r['unread']];
  }
  $recent = [];
  foreach (db()->query('SELECT id, kind, name, created_at, is_read FROM submissions ORDER BY created_at DESC LIMIT 6') as $r) {
    $r['id'] = (int)$r['id'];
    $r['is_read'] = (bool)$r['is_read'];
    $r['created_at'] = iso($r['created_at']);
    $recent[] = $r;
  }
  send(200, [
    'forms' => (object)$forms,
    'recent' => $recent,
    'inbox_unread' => (int)db()->query("SELECT COUNT(*) FROM inbox_messages WHERE direction = 'in' AND status = 'unread'")->fetchColumn(),
    'mail_failed_7d' => (int)db()->query("SELECT COUNT(*) FROM email_log WHERE status IN ('failed','bounced','complained') AND created_at > NOW() - INTERVAL 7 DAY")->fetchColumn(),
    'content_updated' => iso(db()->query('SELECT GREATEST(COALESCE((SELECT MAX(updated_at) FROM content), 0), COALESCE((SELECT MAX(updated_at) FROM items), 0))')->fetchColumn() ?: null),
    'mail_ready' => ['resend' => (cfg()['RESEND_API_KEY'] ?? '') !== '', 'smtp' => (cfg()['SMTP_HOST'] ?? '') !== '', 'inbound' => (cfg()['RESEND_WEBHOOK_SECRET'] ?? '') !== ''],
  ]);
}

/* ---------- content: singletons ---------- */

if (preg_match('#^/admin/content/([^/]+)$#', $path, $m)) {
  $u = require_staff();
  $key = $m[1];
  if (!valid_key($key)) fail(400, 'Bad key');
  if ($method === 'GET') {
    $st = db()->prepare('SELECT data, updated_at, updated_by FROM content WHERE k = ?');
    $st->execute([$key]);
    $row = $st->fetch();
    send(200, $row ? json_col($row['data']) : null);
  }
  if ($method === 'PUT') {
    /* merge-save: a partial save never clobbers fields it did not send */
    $st = db()->prepare('SELECT data FROM content WHERE k = ?');
    $st->execute([$key]);
    $row = $st->fetch();
    $current = $row ? (json_col($row['data']) ?: []) : [];
    $merged = array_merge($current, body_json());
    db()->prepare('INSERT INTO content (k, data, updated_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_by = VALUES(updated_by)')
      ->execute([$key, json_encode($merged, JSON_UNESCAPED_UNICODE), $u['email']]);
    send(200, $merged ?: (object)[]);
  }
  fail(405, 'Method not allowed');
}

/* ---------- content: collections ---------- */

if (preg_match('#^/admin/items/([^/]+)/reorder$#', $path, $m) && $method === 'POST') {
  require_staff();
  $collection = $m[1];
  if (!valid_key($collection)) fail(400, 'Bad collection');
  $order = body_json()['order'] ?? null;
  if (!is_array($order)) fail(400, 'order must be an array of ids');
  $pdo = db();
  $pdo->beginTransaction();
  try {
    $st = $pdo->prepare('UPDATE items SET sort = ? WHERE collection = ? AND id = ?');
    foreach (array_values($order) as $i => $id) $st->execute([$i + 1, $collection, (int)$id]);
    $pdo->commit();
  } catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
  }
  send(200, ['ok' => true]);
}

if (preg_match('#^/admin/items/([^/]+)/(\d+)$#', $path, $m)) {
  require_staff();
  [, $collection, $id] = $m;
  if (!valid_key($collection)) fail(400, 'Bad collection');
  if ($method === 'PUT') {
    $b = body_json();
    $published = $b['published'] ?? null;
    $sort = $b['sort'] ?? null;
    unset($b['published'], $b['sort'], $b['id'], $b['updatedAt']);
    $sets = ['data = ?'];
    $args = [json_encode($b, JSON_UNESCAPED_UNICODE)];
    if ($published !== null) { $sets[] = 'published = ?'; $args[] = $published ? 1 : 0; }
    if ($sort !== null) { $sets[] = 'sort = ?'; $args[] = (int)$sort; }
    $args[] = $collection;
    $args[] = (int)$id;
    $st = db()->prepare('UPDATE items SET ' . implode(', ', $sets) . ' WHERE collection = ? AND id = ?');
    $st->execute($args);
    send(200, ['ok' => true]);
  }
  if ($method === 'DELETE') {
    $st = db()->prepare('DELETE FROM items WHERE collection = ? AND id = ?');
    $st->execute([$collection, (int)$id]);
    if (!$st->rowCount()) fail(404, 'Not found');
    send(200, ['ok' => true]);
  }
  fail(405, 'Method not allowed');
}

if (preg_match('#^/admin/items/([^/]+)$#', $path, $m)) {
  require_staff();
  $collection = $m[1];
  if (!valid_key($collection)) fail(400, 'Bad collection');
  if ($method === 'GET') {
    $st = db()->prepare('SELECT id, data, sort, published, updated_at FROM items WHERE collection = ? ORDER BY sort, id');
    $st->execute([$collection]);
    $out = [];
    foreach ($st as $r) {
      $out[] = array_merge(json_col($r['data']) ?: [], [
        'id' => (int)$r['id'],
        'sort' => (int)$r['sort'],
        'published' => (bool)$r['published'],
        'updatedAt' => iso($r['updated_at']),
      ]);
    }
    send(200, $out);
  }
  if ($method === 'POST') {
    $b = body_json();
    $published = array_key_exists('published', $b) ? (bool)$b['published'] : true;
    unset($b['published'], $b['sort'], $b['id'], $b['updatedAt']);
    $st = db()->prepare('SELECT COALESCE(MAX(sort), 0) FROM items WHERE collection = ?');
    $st->execute([$collection]);
    $sort = (int)$st->fetchColumn() + 1;
    db()->prepare('INSERT INTO items (collection, data, sort, published) VALUES (?, ?, ?, ?)')
      ->execute([$collection, json_encode($b, JSON_UNESCAPED_UNICODE), $sort, $published ? 1 : 0]);
    send(201, ['id' => (int)db()->lastInsertId()]);
  }
  fail(405, 'Method not allowed');
}

/* ---------- uploads (public site images and the catalogue PDF) ----------
   No SVG: an SVG can carry script, and a script served from this origin could
   read the admin's session. Photos and PDFs only. */

if ($method === 'POST' && $path === '/admin/upload') {
  require_staff();
  $allowed = ['image/jpeg' => '.jpg', 'image/png' => '.png', 'image/webp' => '.webp', 'application/pdf' => '.pdf'];
  $f = $_FILES['file'] ?? null;
  if (!$f || $f['error'] === UPLOAD_ERR_NO_FILE) fail(400, 'No file received');
  if ($f['error'] !== UPLOAD_ERR_OK) fail(400, 'Upload failed (code ' . $f['error'] . ')');
  if ($f['size'] > 10 * 1024 * 1024) fail(400, 'That file is larger than 10 MB');
  $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']) ?: '';
  if (!isset($allowed[$mime])) fail(400, 'Only JPG, PNG, WebP or PDF files can be uploaded');
  $dir = cfg()['UPLOAD_DIR'];
  if (!is_dir($dir)) mkdir($dir, 0755, true);
  $name = round(microtime(true) * 1000) . '-' . bin2hex(random_bytes(4)) . $allowed[$mime];
  if (!move_uploaded_file($f['tmp_name'], "$dir/$name")) fail(500, 'Could not store the file');
  if ($mime !== 'application/pdf') shrink_image("$dir/$name", $mime);
  send(201, ['url' => "/uploads/$name", 'size' => (int)(filesize("$dir/$name") ?: $f['size']), 'name' => $f['name']]);
}

if ($method === 'GET' && $path === '/admin/uploads') {
  require_staff();
  $dir = cfg()['UPLOAD_DIR'];
  $out = [];
  foreach (is_dir($dir) ? scandir($dir) : [] as $name) {
    $p = "$dir/$name";
    if ($name[0] === '.' || !is_file($p)) continue;
    $out[] = ['name' => $name, 'url' => "/uploads/$name", 'size' => (int)filesize($p), 'mtime' => date('c', (int)filemtime($p))];
  }
  usort($out, fn ($a, $b) => strcmp($b['mtime'], $a['mtime']));
  send(200, $out);
}

if ($method === 'DELETE' && preg_match('#^/admin/upload/([^/]+)$#', $path, $m)) {
  require_staff();
  $name = basename(rawurldecode($m[1])); // no traversal
  if ($name === '' || $name[0] === '.') fail(400, 'Bad name');
  $target = cfg()['UPLOAD_DIR'] . '/' . $name;
  if (!is_file($target)) fail(404, 'Not found');
  unlink($target);
  send(200, ['ok' => true]);
}

/* ---------- form submissions ---------- */

if ($method === 'GET' && $path === '/admin/submissions') {
  require_staff();
  $kind = isset(FORMS[$_GET['kind'] ?? '']) ? $_GET['kind'] : null;
  $st = db()->prepare('SELECT id, kind, name, email, phone, message, extra, is_read, created_at FROM submissions '
    . ($kind ? 'WHERE kind = ? ' : '') . 'ORDER BY created_at DESC LIMIT 1000');
  $st->execute($kind ? [$kind] : []);
  $rows = [];
  foreach ($st as $r) {
    $r['id'] = (int)$r['id'];
    $r['is_read'] = (bool)$r['is_read'];
    $r['extra'] = json_col($r['extra']) ?: (object)[];
    $r['created_at'] = iso($r['created_at']);
    $rows[] = $r;
  }
  send(200, $rows);
}

if (preg_match('#^/admin/submissions/(\d+)$#', $path, $m) && in_array($method, ['PUT', 'DELETE'], true)) {
  require_staff();
  $id = (int)$m[1];
  if ($method === 'PUT') {
    $read = !empty(body_json()['is_read']);
    db()->prepare('UPDATE submissions SET is_read = ? WHERE id = ?')->execute([$read ? 1 : 0, $id]);
    send(200, ['ok' => true]);
  }
  $st = db()->prepare('SELECT extra FROM submissions WHERE id = ?');
  $st->execute([$id]);
  $extra = json_col($st->fetchColumn() ?: '') ?: [];
  if (!empty($extra['cv']['stored'])) @unlink(cv_dir() . '/' . basename((string)$extra['cv']['stored']));
  db()->prepare('DELETE FROM submissions WHERE id = ?')->execute([$id]);
  send(200, ['ok' => true]);
}

/* the CV sits outside the web root: read back only by a signed-in member of staff */
if ($method === 'GET' && preg_match('#^/admin/submissions/(\d+)/cv$#', $path, $m)) {
  require_staff();
  $st = db()->prepare('SELECT extra FROM submissions WHERE id = ?');
  $st->execute([(int)$m[1]]);
  $cv = (json_col($st->fetchColumn() ?: '') ?: [])['cv'] ?? null;
  $file = $cv ? cv_dir() . '/' . basename((string)$cv['stored']) : '';
  if (!$cv || !is_file($file)) fail(404, 'CV not found');
  header('Content-Type: ' . ($cv['type'] ?: 'application/octet-stream'));
  header('Content-Disposition: attachment; filename="' . str_replace('"', '', (string)$cv['filename']) . '"');
  header('Content-Length: ' . filesize($file));
  header('Cache-Control: private, no-store');
  header('X-Content-Type-Options: nosniff');
  readfile($file);
  exit;
}

/* ---------- the office mailbox ---------- */

if ($method === 'GET' && $path === '/admin/inbox') {
  require_staff();
  $where = match ($_GET['box'] ?? 'inbox') {
    'archived' => "direction = 'in' AND status = 'archived'",
    'sent' => "direction = 'out' AND status != 'deleted'",
    default => "direction = 'in' AND status IN ('unread','read')",
  };
  $rows = [];
  foreach (db()->query("SELECT id, thread_key, direction, from_email, from_name, to_email, subject, LEFT(text_body, 200) AS preview, attachments, status, created_at FROM inbox_messages WHERE $where ORDER BY created_at DESC LIMIT 300") as $r) {
    $r['id'] = (int)$r['id'];
    $r['attachments'] = $r['attachments'] ? count(json_col($r['attachments']) ?: []) : 0;
    $r['created_at'] = iso($r['created_at']);
    $rows[] = $r;
  }
  send(200, [
    'messages' => $rows,
    'unread' => (int)db()->query("SELECT COUNT(*) FROM inbox_messages WHERE direction = 'in' AND status = 'unread'")->fetchColumn(),
  ]);
}

if (preg_match('#^/admin/inbox/(\d+)$#', $path, $m) && $method === 'GET') {
  require_staff();
  $st = db()->prepare('SELECT * FROM inbox_messages WHERE id = ?');
  $st->execute([(int)$m[1]]);
  $msg = $st->fetch();
  if (!$msg) fail(404, 'Not found');
  if ($msg['status'] === 'unread') {
    db()->prepare("UPDATE inbox_messages SET status = 'read' WHERE id = ?")->execute([(int)$m[1]]);
    $msg['status'] = 'read';
  }
  $msg['id'] = (int)$msg['id'];
  $msg['attachments'] = json_col($msg['attachments']) ?: [];
  $msg['created_at'] = iso($msg['created_at']);
  unset($msg['html_body']); // the panel shows the plain-text part: no remote images, no tracking pixels

  $th = db()->prepare("SELECT id, direction, from_email, from_name, subject, text_body, created_at FROM inbox_messages WHERE thread_key = ? AND status != 'deleted' ORDER BY created_at");
  $th->execute([$msg['thread_key']]);
  $thread = [];
  foreach ($th as $t) { $t['id'] = (int)$t['id']; $t['created_at'] = iso($t['created_at']); $thread[] = $t; }
  send(200, ['message' => $msg, 'thread' => $thread]);
}

if (preg_match('#^/admin/inbox/(\d+)/status$#', $path, $m) && $method === 'PUT') {
  require_staff();
  $status = body_json()['status'] ?? '';
  if (!in_array($status, ['unread', 'read', 'archived', 'deleted'], true)) fail(400, 'Bad status');
  db()->prepare('UPDATE inbox_messages SET status = ? WHERE id = ?')->execute([$status, (int)$m[1]]);
  send(200, ['ok' => true]);
}

if (preg_match('#^/admin/inbox/(\d+)/attachment/([0-9a-f]{16})$#', $path, $m) && $method === 'GET') {
  require_staff();
  $st = db()->prepare('SELECT attachments FROM inbox_messages WHERE id = ?');
  $st->execute([(int)$m[1]]);
  foreach (json_col($st->fetchColumn() ?: '') ?: [] as $a) {
    if (($a['id'] ?? '') !== $m[2]) continue;
    $file = mail_attachment_dir() . '/' . basename((string)$a['stored']);
    if (!is_file($file)) fail(404, 'That file is gone');
    header('Content-Type: ' . ($a['content_type'] ?: 'application/octet-stream'));
    header('Content-Disposition: attachment; filename="' . str_replace('"', '', (string)$a['filename']) . '"');
    header('Content-Length: ' . filesize($file));
    header('X-Content-Type-Options: nosniff');
    readfile($file);
    exit;
  }
  fail(404, 'Not found');
}

/* a file staged for an outgoing message; compose and reply reference it by id */
if ($method === 'POST' && $path === '/admin/inbox/attachment') {
  require_staff();
  $f = $_FILES['file'] ?? null;
  if (!$f || $f['error'] === UPLOAD_ERR_NO_FILE) fail(400, 'No file received');
  if ($f['error'] !== UPLOAD_ERR_OK) fail(400, 'Upload failed — please try a smaller file');
  if ($f['size'] > 8 * 1024 * 1024) fail(400, 'That file is larger than 8 MB');
  $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']) ?: 'application/octet-stream';
  if (preg_match('/(x-msdownload|x-msdos-program|x-sh|x-executable|javascript|php)/i', $mime)) {
    fail(400, 'That kind of file cannot be sent by email');
  }
  $id = bin2hex(random_bytes(8));
  $safe = preg_replace('/[^A-Za-z0-9._ -]/', '_', basename((string)$f['name'])) ?: 'attachment';
  $stored = $id . '_' . mb_substr($safe, 0, 120);
  if (!move_uploaded_file($f['tmp_name'], mail_attachment_dir() . '/' . $stored)) fail(500, 'Could not store the file');
  send(201, ['id' => $id, 'filename' => $safe, 'size' => (int)$f['size'], 'content_type' => $mime, 'stored' => $stored]);
}

/* what the panel sent → [files for the mailer, metadata for the Sent copy] */
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

if (preg_match('#^/admin/inbox/(\d+)/reply$#', $path, $m) && $method === 'POST') {
  $u = require_staff();
  $b = body_json();
  $text = trim((string)($b['text'] ?? ''));
  if ($text === '') fail(400, 'Write something first');
  $st = db()->prepare('SELECT * FROM inbox_messages WHERE id = ?');
  $st->execute([(int)$m[1]]);
  $orig = $st->fetch();
  if (!$orig) fail(404, 'Not found');

  $subject = preg_match('/^\s*re\s*:/i', (string)$orig['subject']) ? $orig['subject'] : 'Re: ' . $orig['subject'];
  $ref = (string)($orig['message_id'] ?? '');
  /* real threading in the recipient's mail client */
  $opts = $ref !== '' && str_contains($ref, '@') ? ['headers' => ['In-Reply-To' => "<$ref>", 'References' => "<$ref>"]] : [];
  [$files, $attMeta] = outbound_attachments($b['attachments'] ?? []);
  if ($files) $opts['attachments'] = $files;
  send_mail((string)$orig['from_email'], $subject, $text, cfg()['NOTIFY_EMAIL'] ?? '', $opts);

  db()->prepare('INSERT INTO inbox_messages (thread_key, direction, from_email, from_name, to_email, subject, text_body, attachments, in_reply_to, status) VALUES (?,?,?,?,?,?,?,?,?,?)')
    ->execute([
      $orig['thread_key'], 'out', mail_from()[0], $u['name'] ?: $u['email'],
      (string)$orig['from_email'], mb_substr($subject, 0, 255), $text,
      $attMeta ? json_encode($attMeta, JSON_UNESCAPED_UNICODE) : null,
      $ref ?: null, 'read',
    ]);
  db()->prepare("UPDATE inbox_messages SET status = 'read' WHERE id = ? AND status = 'unread'")->execute([(int)$m[1]]);
  send(200, ['ok' => true]);
}

/* a new message — also how a form submission is answered from the admin */
if ($method === 'POST' && $path === '/admin/inbox/compose') {
  $u = require_staff();
  $b = body_json();
  $to = strtolower(trim((string)($b['to'] ?? '')));
  $subject = trim((string)($b['subject'] ?? ''));
  $text = trim((string)($b['text'] ?? ''));
  if (!valid_email($to)) fail(400, 'A valid recipient is required');
  if ($subject === '' || $text === '') fail(400, 'A subject and a message are required');
  [$files, $attMeta] = outbound_attachments($b['attachments'] ?? []);
  send_mail($to, $subject, $text, cfg()['NOTIFY_EMAIL'] ?? '', $files ? ['attachments' => $files] : []);
  db()->prepare('INSERT INTO inbox_messages (thread_key, direction, from_email, from_name, to_email, subject, text_body, attachments, status) VALUES (?,?,?,?,?,?,?,?,?)')
    ->execute([
      thread_key($subject), 'out', mail_from()[0], $u['name'] ?: $u['email'], $to,
      mb_substr($subject, 0, 255), $text,
      $attMeta ? json_encode($attMeta, JSON_UNESCAPED_UNICODE) : null, 'read',
    ]);
  if (!empty($b['submission_id'])) {
    db()->prepare('UPDATE submissions SET is_read = 1 WHERE id = ?')->execute([(int)$b['submission_id']]);
  }
  send(200, ['ok' => true]);
}

/* ---------- the email log ---------- */

if ($method === 'GET' && $path === '/admin/emails') {
  require_staff();
  $rows = [];
  foreach (db()->query('SELECT id, to_email, subject, provider, status, error, created_at, updated_at FROM email_log ORDER BY created_at DESC LIMIT 300') as $r) {
    $r['id'] = (int)$r['id'];
    $r['created_at'] = iso($r['created_at']);
    $r['updated_at'] = iso($r['updated_at']);
    $rows[] = $r;
  }
  send(200, $rows);
}

if ($method === 'POST' && $path === '/admin/emails/test') {
  $u = require_staff();
  rate_limit('mailtest', 300, 10);
  $to = strtolower(trim((string)(body_json()['to'] ?? '')));
  if (!valid_email($to)) $to = $u['email'];
  send_mail($to, 'Skyline test email', "This is a test from the Skyline website admin.\n\nIf you are reading it, outgoing mail works.", cfg()['NOTIFY_EMAIL'] ?? '');
  $row = db()->query('SELECT provider, status, error FROM email_log ORDER BY id DESC LIMIT 1')->fetch();
  send(200, array_merge(['ok' => true, 'to' => $to], $row ?: []));
}

/* ============================================================
   ADMIN ONLY — the team
   ============================================================ */

if ($method === 'GET' && $path === '/admin/users') {
  require_admin();
  $rows = [];
  foreach (db()->query('SELECT id, email, name, role, is_disabled, created_at, last_login_at FROM users ORDER BY created_at') as $r) {
    $r['id'] = (int)$r['id'];
    $r['is_disabled'] = (bool)$r['is_disabled'];
    $r['created_at'] = iso($r['created_at']);
    $r['last_login_at'] = iso($r['last_login_at']);
    $rows[] = $r;
  }
  send(200, $rows);
}

if ($method === 'POST' && $path === '/admin/users') {
  require_admin();
  $b = body_json();
  $email = strtolower(clean($b['email'] ?? '', 190));
  $name = clean($b['name'] ?? '', 120);
  $role = in_array($b['role'] ?? '', ROLES, true) ? $b['role'] : 'editor';
  if (!valid_email($email)) fail(400, 'A valid email address is required');
  $st = db()->prepare('SELECT id FROM users WHERE email = ?');
  $st->execute([$email]);
  if ($st->fetch()) fail(409, 'Someone with that email already has an account');
  /* no password is ever emailed: they choose one through a one-time link */
  db()->prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?,?,?,?)')
    ->execute([$email, $name ?: null, hash_password(bin2hex(random_bytes(24))), $role]);
  $id = (int)db()->lastInsertId();
  send_reset_link(['id' => $id, 'email' => $email, 'name' => $name], 72 * 3600, true);
  send(201, ['id' => $id]);
}

if (preg_match('#^/admin/users/(\d+)$#', $path, $m) && $method === 'PUT') {
  $me = require_admin();
  $id = (int)$m[1];
  $b = body_json();
  $st = db()->prepare('SELECT * FROM users WHERE id = ?');
  $st->execute([$id]);
  $user = $st->fetch();
  if (!$user) fail(404, 'Not found');
  $role = array_key_exists('role', $b) && in_array($b['role'], ROLES, true) ? $b['role'] : $user['role'];
  $disabled = array_key_exists('is_disabled', $b) ? (bool)$b['is_disabled'] : (bool)$user['is_disabled'];
  $name = array_key_exists('name', $b) ? clean($b['name'], 120) : $user['name'];
  if ($id === $me['id'] && ($disabled || $role !== 'admin')) fail(400, 'You cannot lock yourself out — ask another admin');
  /* the team must always keep one working admin */
  if ($user['role'] === 'admin' && ($role !== 'admin' || $disabled)) {
    $n = (int)db()->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_disabled = 0")->fetchColumn();
    if ($n <= 1) fail(400, 'This is the only admin — make someone else an admin first');
  }
  db()->prepare('UPDATE users SET role = ?, is_disabled = ?, name = ? WHERE id = ?')
    ->execute([$role, $disabled ? 1 : 0, $name ?: null, $id]);
  send(200, ['ok' => true]);
}

if (preg_match('#^/admin/users/(\d+)/invite$#', $path, $m) && $method === 'POST') {
  require_admin();
  $st = db()->prepare('SELECT id, email, name FROM users WHERE id = ? AND is_disabled = 0');
  $st->execute([(int)$m[1]]);
  $user = $st->fetch();
  if (!$user) fail(404, 'Not found');
  send_reset_link($user, 72 * 3600, true);
  send(200, ['ok' => true]);
}

fail(404, 'Not found');
