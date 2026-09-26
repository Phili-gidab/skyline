<?php
/*
 * Skyline API — mailbox routes: reading and sending from the office's
 * @domain mailboxes, and (administrators) setting them up. The helpers —
 * who may open which box, filing incoming mail — are in mail.php.
 */

declare(strict_types=1);

const MAIL_FOLDERS = [
  'inbox' => "direction = 'in' AND status IN ('unread','read')",
  'sent' => "direction = 'out' AND status IN ('unread','read','archived')",
  'archived' => "direction = 'in' AND status = 'archived'",
  'spam' => "status = 'spam'",
  'trash' => "status = 'deleted'",
];

function present_mail(array $r, bool $full = false): array {
  $out = [
    'id' => (int)$r['id'],
    'mailbox_id' => $r['mailbox_id'] !== null ? (int)$r['mailbox_id'] : null,
    'thread_key' => $r['thread_key'],
    'direction' => $r['direction'],
    'from_email' => $r['from_email'],
    'from_name' => $r['from_name'],
    'to_email' => $r['to_email'],
    'cc_email' => $r['cc_email'] ?? null,
    'reply_to' => $r['reply_to'] ?? null,
    'subject' => $r['subject'],
    'status' => $r['status'],
    'source' => $r['source'] ?? null,
    'submission_id' => !empty($r['submission_id']) ? (int)$r['submission_id'] : null,
    'delivery' => $r['delivery'] ?? null,
    'auth' => $r['auth'] ?? null,
    'created_at' => iso($r['created_at']),
  ];
  if ($full) {
    $out['text_body'] = (string)$r['text_body'];
    $html = (string)($r['html_body'] ?? '');
    $out['html'] = $html !== '' && strlen($html) < 1_500_000 ? $html : null;
    $out['attachments'] = array_map(fn ($a) => [
      'id' => $a['id'], 'filename' => $a['filename'], 'size' => (int)($a['size'] ?? 0),
      'content_type' => $a['content_type'] ?? 'application/octet-stream', 'cid' => $a['cid'] ?? null,
    ], json_col($r['attachments'] ?? null) ?: []);
    $out['in_reply_to'] = $r['in_reply_to'];
    $out['message_id'] = $r['message_id'];
  } else {
    $out['preview'] = trim(preg_replace('/\s+/', ' ', (string)($r['preview'] ?? '')));
    $out['attachments'] = $r['attachments'] ? count(json_col($r['attachments']) ?: []) : 0;
    $out['thread_n'] = (int)($r['thread_n'] ?? 1);
  }
  return $out;
}

/* ---------- the boxes this person has ---------- */

if ($method === 'GET' && $path === '/admin/mail/boxes') {
  $u = require_staff();
  $boxes = user_mailboxes($u);
  $unread = mailbox_unread(array_column($boxes, 'id'));
  foreach ($boxes as &$b) $b['unread'] = $unread[$b['id']] ?? 0;
  unset($b);
  send(200, ['boxes' => $boxes, 'domain' => mail_domain(), 'signature' => user_signature($u)]);
}

/* ---------- a folder of one box ---------- */

if ($method === 'GET' && $path === '/admin/mail/messages') {
  $u = require_staff();
  $box = mailbox_find($u, (int)($_GET['box'] ?? 0));
  if (!$box) fail(404, 'Mailbox not found');
  $folder = isset(MAIL_FOLDERS[$_GET['folder'] ?? '']) ? (string)$_GET['folder'] : 'inbox';
  $args = [$box['id']];
  $search = '';
  $q = trim((string)($_GET['q'] ?? ''));
  if ($q !== '') {
    $like = '%' . addcslashes(mb_substr($q, 0, 100), '%_\\') . '%';
    $search = ' AND (m.subject LIKE ? OR m.from_email LIKE ? OR m.from_name LIKE ? OR m.to_email LIKE ? OR m.text_body LIKE ?)';
    array_push($args, $like, $like, $like, $like, $like);
  }
  $where = str_replace(['direction', 'status'], ['m.direction', 'm.status'], MAIL_FOLDERS[$folder]);
  $st = db()->prepare("SELECT m.id, m.mailbox_id, m.thread_key, m.direction, m.from_email, m.from_name, m.to_email, m.reply_to, m.subject,
      LEFT(m.text_body, 220) AS preview, m.attachments, m.status, m.source, m.submission_id, m.delivery, m.auth, m.created_at,
      (SELECT COUNT(*) FROM inbox_messages t WHERE t.mailbox_id = m.mailbox_id AND t.thread_key = m.thread_key AND t.status != 'deleted') AS thread_n
    FROM inbox_messages m WHERE m.mailbox_id = ? AND $where$search ORDER BY m.created_at DESC, m.id DESC LIMIT 200");
  $st->execute($args);
  $rows = array_map('present_mail', $st->fetchAll());

  $c = db()->prepare("SELECT SUM(direction = 'in' AND status = 'unread') AS inbox, SUM(status = 'spam') AS spam, SUM(status = 'deleted') AS trash FROM inbox_messages WHERE mailbox_id = ?");
  $c->execute([$box['id']]);
  $counts = array_map('intval', $c->fetch() ?: []);
  send(200, ['box' => $box, 'folder' => $folder, 'messages' => $rows, 'counts' => $counts]);
}

/* ---------- one conversation ---------- */

if (preg_match('#^/admin/mail/messages/(\d+)$#', $path, $m) && $method === 'GET') {
  $u = require_staff();
  $msg = message_for($u, (int)$m[1]);
  $box = $msg['box'];

  /* reading marks the conversation read — but an administrator looking into
     someone else's box leaves it as its owner will find it */
  if (!$box || $box['member']) {
    db()->prepare("UPDATE inbox_messages SET status = 'read' WHERE mailbox_id <=> ? AND thread_key = ? AND status = 'unread'")
      ->execute([$msg['mailbox_id'], $msg['thread_key']]);
  }
  $st = db()->prepare("SELECT * FROM inbox_messages WHERE mailbox_id <=> ? AND thread_key = ? AND (status != 'deleted' OR id = ?) ORDER BY created_at, id");
  $st->execute([$msg['mailbox_id'], $msg['thread_key'], $msg['id']]);
  $thread = array_map(fn ($r) => present_mail($r, true), $st->fetchAll());

  $sub = null;
  if (!empty($msg['submission_id']) && can($u, 'messages')) {
    $s = db()->prepare('SELECT id, kind, name, phone, email FROM submissions WHERE id = ?');
    $s->execute([(int)$msg['submission_id']]);
    $sub = $s->fetch() ?: null;
    if ($sub) $sub['id'] = (int)$sub['id'];
  }
  send(200, ['focus' => (int)$msg['id'], 'box' => $box, 'thread' => $thread, 'submission' => $sub]);
}

/* read / unread / archive / spam / trash — and back */
if (preg_match('#^/admin/mail/messages/(\d+)$#', $path, $m) && $method === 'PUT') {
  $u = require_staff();
  $msg = message_for($u, (int)$m[1]);
  $status = (string)(body_json()['status'] ?? '');
  if (!in_array($status, ['unread', 'read', 'archived', 'spam', 'deleted'], true)) fail(400, 'Unknown status');
  if ($msg['direction'] === 'out' && !in_array($status, ['read', 'deleted'], true)) fail(400, 'A sent message can only be deleted or restored');
  db()->prepare('UPDATE inbox_messages SET status = ? WHERE id = ?')->execute([$status, (int)$msg['id']]);
  send(200, ['ok' => true]);
}

/* gone for good — only from the trash */
if (preg_match('#^/admin/mail/messages/(\d+)$#', $path, $m) && $method === 'DELETE') {
  $u = require_staff();
  $msg = message_for($u, (int)$m[1]);
  if ($msg['status'] !== 'deleted') fail(400, 'Move it to the trash first');
  db()->prepare('DELETE FROM inbox_messages WHERE id = ?')->execute([(int)$msg['id']]);
  send(200, ['ok' => true]);
}

/* the same change for a selection, or "empty trash" */
if ($method === 'POST' && $path === '/admin/mail/bulk') {
  $u = require_staff();
  $b = body_json();
  $status = (string)($b['status'] ?? '');
  if ($status === 'purge') {
    $box = mailbox_find($u, (int)($b['box'] ?? 0));
    if (!$box) fail(404, 'Mailbox not found');
    $st = db()->prepare("DELETE FROM inbox_messages WHERE mailbox_id = ? AND status = 'deleted'");
    $st->execute([$box['id']]);
    send(200, ['ok' => true, 'n' => $st->rowCount()]);
  }
  if (!in_array($status, ['unread', 'read', 'archived', 'spam', 'deleted'], true)) fail(400, 'Unknown status');
  $n = 0;
  foreach (array_slice((array)($b['ids'] ?? []), 0, 500) as $id) {
    $msg = message_for($u, (int)$id);
    if ($msg['direction'] === 'out' && !in_array($status, ['read', 'deleted'], true)) continue;
    db()->prepare('UPDATE inbox_messages SET status = ? WHERE id = ?')->execute([$status, (int)$msg['id']]);
    $n++;
  }
  send(200, ['ok' => true, 'n' => $n]);
}

/* ---------- files ---------- */

if (preg_match('#^/admin/mail/messages/(\d+)/attachments/([0-9a-f]{16})$#', $path, $m) && $method === 'GET') {
  $u = require_staff();
  $msg = message_for($u, (int)$m[1]);
  foreach (json_col($msg['attachments'] ?: '') ?: [] as $a) {
    if (($a['id'] ?? '') !== $m[2]) continue;
    $file = mail_attachment_dir() . '/' . basename((string)$a['stored']);
    if (!is_file($file)) fail(404, 'That file is gone');
    $type = (string)($a['content_type'] ?: 'application/octet-stream');
    $inline = !empty($_GET['view']) && preg_match('#^(application/pdf|image/(jpeg|png|gif|webp))$#', $type);
    header('Content-Type: ' . $type);
    header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename="' . str_replace('"', '', (string)$a['filename']) . '"');
    header('Content-Length: ' . filesize($file));
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    readfile($file);
    exit;
  }
  fail(404, 'Not found');
}

/* a file staged for an outgoing message; Send references it by id */
if ($method === 'POST' && $path === '/admin/mail/attachments') {
  $u = require_staff();
  if (!array_filter(user_mailboxes($u), fn ($b) => $b['member'])) fail(403, 'You have no mailbox to send from');
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

/* ---------- sending: new, reply, forward ---------- */

if ($method === 'POST' && $path === '/admin/mail/send') {
  $u = require_staff();
  rate_limit('mailsend', 300, 60);
  $b = body_json();
  $box = mailbox_find($u, (int)($b['from_box'] ?? 0));
  if (!$box) fail(404, 'Mailbox not found');
  if (!$box['member']) fail(403, "You can read {$box['address']} but not send from it");

  $to = recipients($b['to'] ?? '');
  $cc = array_values(array_diff(recipients($b['cc'] ?? ''), $to));
  $subject = trim(clean($b['subject'] ?? '', 255));
  $text = rtrim(str_replace("\r", '', (string)($b['text'] ?? '')));
  if (!$to) fail(400, 'Add at least one recipient');
  if ($subject === '') fail(400, 'Add a subject');
  if (trim($text) === '' && empty($b['forward_of'])) fail(400, 'Write something first');
  if (mb_strlen($text) > 100000) fail(400, 'That message is too long');

  $reply = !empty($b['reply_to_id']) ? message_for($u, (int)$b['reply_to_id']) : null;
  $fwd = !empty($b['forward_of']) ? message_for($u, (int)$b['forward_of']) : null;

  $body = $text;
  if ($reply && !empty($b['quote'])) $body .= quote_block($reply);
  if ($fwd) $body .= forward_block($fwd);

  [$files, $attMeta] = outbound_attachments($b['attachments'] ?? []);
  if ($fwd) {
    /* a forward carries the original's files along */
    foreach (json_col($fwd['attachments'] ?: '') ?: [] as $a) {
      $file = mail_attachment_dir() . '/' . basename((string)$a['stored']);
      if (!is_file($file)) continue;
      $files[] = ['path' => $file, 'filename' => (string)$a['filename']];
      $attMeta[] = $a;
    }
  }

  $opts = [
    'from' => [$box['address'], $box['name']], // the name set on the mailbox — a person's own box carries their name
    'cc' => $cc,
    'style' => 'personal',
    'attachments' => $files,
  ];
  if ($reply && !empty($reply['message_id'])) {
    /* real threading in the recipient's mail client */
    $refs = array_filter([$reply['in_reply_to'] ?? '', $reply['message_id']]);
    $opts['headers'] = [
      'In-Reply-To' => '<' . $reply['message_id'] . '>',
      'References' => implode(' ', array_map(fn ($r) => '<' . trim($r, '<>') . '>', array_unique($refs))),
    ];
  }
  $r = send_mail($to, $subject, $body, '', $opts);
  if (!$r['sent']) fail(502, 'Not sent — ' . $r['error']);

  $thread = $reply && (int)$reply['mailbox_id'] === $box['id'] ? $reply['thread_key'] : subject_thread($subject, $to[0]);
  db()->prepare('INSERT INTO inbox_messages (mailbox_id, resend_id, thread_key, direction, from_email, from_name, to_email, cc_email, subject, text_body, attachments, in_reply_to, status, delivery, sent_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    ->execute([
      $box['id'], $r['id'], $thread, 'out', $box['address'], $opts['from'][1],
      mb_substr(implode(', ', $to), 0, 500), $cc ? mb_substr(implode(', ', $cc), 0, 500) : null,
      mb_substr($subject, 0, 255), $body,
      $attMeta ? json_encode($attMeta, JSON_UNESCAPED_UNICODE) : null,
      $reply && !empty($reply['message_id']) ? $reply['message_id'] : null, 'read', 'sent', $u['id'],
    ]);
  $id = (int)db()->lastInsertId();
  if ($reply) db()->prepare("UPDATE inbox_messages SET status = 'read' WHERE id = ? AND status = 'unread'")->execute([(int)$reply['id']]);
  if (!empty($b['submission_id']) && can($u, 'messages')) {
    db()->prepare('UPDATE submissions SET is_read = 1 WHERE id = ?')->execute([(int)$b['submission_id']]);
  }
  send(201, ['ok' => true, 'id' => $id]);
}

/* ============================================================
   ADMIN ONLY — setting the mailboxes up
   ============================================================ */

function mailbox_members_of(int $id): array {
  $st = db()->prepare('SELECT user_id FROM mailbox_members WHERE mailbox_id = ? ORDER BY user_id');
  $st->execute([$id]);
  return array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
}

function save_mailbox_members(int $id, $list): void {
  db()->prepare('DELETE FROM mailbox_members WHERE mailbox_id = ?')->execute([$id]);
  $ins = db()->prepare('INSERT IGNORE INTO mailbox_members (mailbox_id, user_id) SELECT ?, id FROM users WHERE id = ?');
  foreach (array_unique(array_map('intval', (array)$list)) as $uid) if ($uid > 0) $ins->execute([$id, $uid]);
}

function set_catch_all(int $id): void {
  db()->prepare('UPDATE mailboxes SET catch_all = (id = ?)')->execute([$id]);
}

function set_website_box(int $id): void {
  db()->prepare('UPDATE mailboxes SET website = (id = ?)')->execute([$id]);
}

if ($method === 'GET' && $path === '/admin/mail/settings') {
  require_admin();
  $counts = [];
  foreach (db()->query("SELECT mailbox_id, COUNT(*) AS n, SUM(direction = 'in' AND status = 'unread') AS unread FROM inbox_messages GROUP BY mailbox_id") as $r) {
    $counts[(int)$r['mailbox_id']] = ['messages' => (int)$r['n'], 'unread' => (int)$r['unread']];
  }
  $boxes = [];
  foreach (db()->query("SELECT * FROM mailboxes ORDER BY kind = 'shared' DESC, address") as $row) {
    $b = mailbox_row($row);
    $b['members'] = mailbox_members_of($b['id']);
    $b += $counts[$b['id']] ?? ['messages' => 0, 'unread' => 0];
    $boxes[] = $b;
  }
  $users = [];
  foreach (db()->query('SELECT id, email, name, role, is_disabled FROM users ORDER BY name, email') as $r) {
    $users[] = ['id' => (int)$r['id'], 'email' => $r['email'], 'name' => $r['name'], 'role' => $r['role'], 'is_disabled' => (bool)$r['is_disabled']];
  }
  send(200, [
    'boxes' => $boxes,
    'users' => $users,
    'domain' => mail_domain(),
    'website' => website_mailbox()['address'] ?? null,
  ]);
}

if ($method === 'POST' && $path === '/admin/mail/settings') {
  require_admin();
  $b = body_json();
  $address = own_address_from((string)($b['address'] ?? ''));
  if ($address === '') fail(400, 'Choose an address at @' . mail_domain() . ' — letters, numbers, dots and dashes');
  if (mailbox_by_address($address)) fail(409, "$address already exists");
  $st = db()->prepare('SELECT 1 FROM users WHERE email = ?');
  $st->execute([$address]);
  if ($st->fetchColumn()) fail(409, "$address is someone's sign-in address");
  $name = clean($b['name'] ?? '', 120) ?: 'Skyline Travel Solution';
  $roles = array_values(array_intersect(ROLES, (array)($b['roles'] ?? [])));
  db()->prepare("INSERT INTO mailboxes (address, name, kind, roles) VALUES (?, ?, 'shared', ?)")
    ->execute([$address, $name, json_encode($roles)]);
  $id = (int)db()->lastInsertId();
  save_mailbox_members($id, $b['members'] ?? []);
  if (!empty($b['catch_all'])) set_catch_all($id);
  if (!empty($b['website'])) set_website_box($id);
  send(201, ['id' => $id]);
}

if (preg_match('#^/admin/mail/settings/(\d+)$#', $path, $m) && $method === 'PUT') {
  require_admin();
  $id = (int)$m[1];
  $st = db()->prepare('SELECT * FROM mailboxes WHERE id = ?');
  $st->execute([$id]);
  $row = $st->fetch();
  if (!$row) fail(404, 'Mailbox not found');
  $b = body_json();
  if (array_key_exists('name', $b)) {
    $name = clean($b['name'], 120);
    if ($name === '') fail(400, 'The name people see is required');
    db()->prepare('UPDATE mailboxes SET name = ? WHERE id = ?')->execute([$name, $id]);
  }
  if ($row['kind'] === 'shared') {
    if (array_key_exists('roles', $b)) {
      db()->prepare('UPDATE mailboxes SET roles = ? WHERE id = ?')->execute([json_encode(array_values(array_intersect(ROLES, (array)$b['roles']))), $id]);
    }
    if (array_key_exists('members', $b)) save_mailbox_members($id, $b['members']);
  }
  if (!empty($b['catch_all'])) set_catch_all($id);
  if (!empty($b['website'])) set_website_box($id);
  send(200, ['ok' => true]);
}

if (preg_match('#^/admin/mail/settings/(\d+)$#', $path, $m) && $method === 'DELETE') {
  require_admin();
  $id = (int)$m[1];
  $st = db()->prepare('SELECT * FROM mailboxes WHERE id = ?');
  $st->execute([$id]);
  $row = $st->fetch();
  if (!$row) fail(404, 'Mailbox not found');
  if ($row['kind'] !== 'shared') fail(400, "A person's own mailbox goes when their account does");
  if ((int)$row['catch_all']) fail(400, 'Make another mailbox the catch-all first');
  if ((int)($row['website'] ?? 0)) fail(400, 'Choose another mailbox for the website first');
  $n = db()->prepare('SELECT COUNT(*) FROM inbox_messages WHERE mailbox_id = ?');
  $n->execute([$id]);
  if ((int)$n->fetchColumn() > 0) fail(409, 'This mailbox still has messages — delete them first');
  db()->prepare('DELETE FROM mailbox_members WHERE mailbox_id = ?')->execute([$id]);
  db()->prepare('DELETE FROM mailboxes WHERE id = ?')->execute([$id]);
  send(200, ['ok' => true]);
}
