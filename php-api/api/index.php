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
require __DIR__ . '/mail.php';

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
  /* the full application: replaces sending documents over Telegram */
  'application' => [
    'label' => 'Visa application',
    'extra' => ['destination' => 'Destination', 'visa' => 'Visa type', 'travel' => 'Intake / travel date'],
    'email_required' => true,
  ],
];

/* which forms take documents, and whether at least one is required */
const DOCUMENT_FORMS = ['application' => true, 'study' => false, 'enquiry' => false];

/* what an applicant can say a file is — anything else is filed as "Other" */
const DOCUMENT_LABELS = [
  'Passport', 'Passport photo', 'Bank statement', 'Transcript / certificate', 'Diploma',
  'Invitation letter', 'Employment letter', 'CV', 'Language certificate', 'Other',
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

/* Staff sign in with their own address at the office's domain (just "hana"
   will do). The private address they gave for password resets also works,
   so nobody is locked out while they get used to the new one. */
function find_login(string $input): array {
  $input = strtolower(trim($input));
  if ($input === '') return [];
  $own = own_address_from($input);
  $st = db()->prepare('SELECT * FROM users WHERE is_disabled = 0 AND (email = ? OR email = ? OR recovery_email = ?) ORDER BY email = ? DESC');
  $st->execute([$own ?: $input, $input, $input, $own ?: $input]);
  return $st->fetchAll();
}

if ($method === 'POST' && $path === '/auth/login') {
  $b = body_json();
  $login = clean($b['email'] ?? '', 190);
  $password = (string)($b['password'] ?? '');
  if ($login === '' || $password === '') fail(400, 'Your address and password are required');
  /* failed attempts only, from this connection and against this account */
  $acct = 'acct:' . strtolower(own_address_from($login) ?: $login);
  if (rate_blocked('login', 900, 20) || rate_blocked('login', 900, 8, $acct)) fail(429, 'Too many wrong attempts — wait a few minutes and try again');
  $user = null;
  $candidates = find_login($login);
  foreach ($candidates as $candidate) {
    if (password_verify($password, str_replace('$2a$', '$2y$', $candidate['password_hash']))) { $user = $candidate; break; }
  }
  /* the same work whether or not the account exists, so timing gives nothing away */
  if (!$candidates) password_verify($password, '$2y$11$abcdefghijklmnopqrstuuJxQnVg3BxVdC6ZMaBLmJ4jlS2ICmr2i');
  if (!$user) {
    rate_fail('login', 900);
    rate_fail('login', 900, $acct);
    fail(401, 'That address or password is not right');
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
  foreach (find_login(clean(body_json()['email'] ?? '', 190)) as $user) {
    send_reset_link($user, 3600, false);
    break;
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
  /* a new password ends every session signed with the old one */
  db()->prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?')->execute([hash_password($password), $reset['user_id']]);
  db()->prepare('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL')->execute([$reset['user_id']]);
  send(200, ['ok' => true]);
}

/* Where a sign-in link may go: the person's private address, never one at
   the office's domain — those are read inside the admin, a shared box by
   several people, so a link there would hand the account to whoever reads it. */
function reset_destination(array $user): string {
  $r = strtolower(trim((string)($user['recovery_email'] ?? '')));
  if ($r !== '' && valid_email($r) && !own_address($r)) return $r;
  $e = strtolower((string)$user['email']);
  return own_address($e) ? '' : $e;
}

/* a one-time link to set a password — for a forgotten one, or a new colleague */
function send_reset_link(array $user, int $ttl, bool $invite): bool {
  $to = reset_destination($user);
  if ($to === '') return false;
  $token = bin2hex(random_bytes(32));
  db()->prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))')
    ->execute([(int)$user['id'], hash('sha256', $token), $ttl]);
  $link = site_url('/admin/reset?token=' . $token);
  $who = $user['name'] ?: $user['email'];
  if ($invite) {
    $r = send_mail(
      $to,
      'Your Skyline office account',
      "Hello $who,\n\nAn account has been made for you on the Skyline Travel Solution office admin, with your own mailbox: {$user['email']}.\n\n"
      . "Choose your password here (the link works for " . round($ttl / 3600) . " hours):\n$link\n\n"
      . "Then sign in at " . site_url('/admin') . " with {$user['email']}.\n\nSkyline Travel Solution"
    );
  } else {
    $r = send_mail(
      $to,
      'Reset your Skyline password',
      "Hello $who,\n\nSomeone — hopefully you — asked to reset the password for {$user['email']}.\n\n"
      . "Choose a new password here (the link works for one hour, once):\n$link\n\n"
      . "If you did not ask for this, ignore this email; your password has not changed.\n\nSkyline Travel Solution"
    );
  }
  return $r['sent'];
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

function document_dir(): string { return private_dir('documents'); }

/* Applicants' documents: passports, photos, statements, certificates.
   The type is read from the file's content, never trusted from its name —
   a renamed script is refused. Phones send HEIC photos, so those are kept. */
function accept_documents(bool $required): array {
  $raw = $_FILES['documents'] ?? null;
  $files = [];
  if ($raw && is_array($raw['name'])) {
    foreach ($raw['name'] as $i => $n) {
      if (($raw['error'][$i] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) continue;
      $files[] = ['name' => $n, 'tmp_name' => $raw['tmp_name'][$i], 'error' => $raw['error'][$i], 'size' => $raw['size'][$i]];
    }
  } elseif ($raw && ($raw['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $files[] = $raw;
  }
  if (!$files) {
    if ($required) fail(400, 'Please attach at least one document — your passport, to start with');
    return [];
  }
  if (count($files) > 12) fail(400, 'Please send no more than 12 documents at a time');

  $labels = (array)($_POST['doc_labels'] ?? []);
  $types = [
    'application/pdf' => 'pdf',
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/heic' => 'heic',
    'image/heif' => 'heic',
    'application/msword' => 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
  ];
  $finfo = new finfo(FILEINFO_MIME_TYPE);

  // check everything before storing anything, so a bad file leaves nothing behind
  $total = 0;
  $checked = [];
  foreach ($files as $i => $f) {
    $name = (string)$f['name'];
    if ($f['error'] !== UPLOAD_ERR_OK) fail(400, "\"$name\" did not upload — please try again, or send a smaller file");
    if ($f['size'] > 10 * 1024 * 1024) fail(400, "\"$name\" is larger than 10 MB — please send a smaller copy");
    $total += (int)$f['size'];
    $mime = $finfo->file($f['tmp_name']) ?: '';
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    $kind = $types[$mime] ?? null;
    if (!$kind && $ext === 'docx' && in_array($mime, ['application/zip', 'application/octet-stream'], true)) {
      $zip = (string)file_get_contents($f['tmp_name'], false, null, 0, 4096);
      if (str_starts_with($zip, 'PK') && str_contains($zip, 'word/')) $kind = 'docx';
    }
    if (!$kind) fail(400, "\"$name\" is not a PDF, photo or Word document");
    $label = in_array($labels[$i] ?? '', DOCUMENT_LABELS, true) ? $labels[$i] : 'Other';
    $checked[] = [$f, $kind, $mime, $label];
  }
  if ($total > 40 * 1024 * 1024) fail(400, 'Together your documents are over 40 MB — please send smaller copies');

  $dir = document_dir();
  $out = [];
  foreach ($checked as [$f, $kind, $mime, $label]) {
    $stored = gmdate('Ymd') . '-' . bin2hex(random_bytes(8)) . ".$kind";
    if (!move_uploaded_file($f['tmp_name'], "$dir/$stored")) {
      foreach ($out as $done) @unlink("$dir/{$done['stored']}");
      fail(500, 'Could not store your documents — please try again');
    }
    $name = preg_replace('/[^A-Za-z0-9._ ()-]/', '_', basename((string)$f['name'])) ?: "document.$kind";
    $out[] = ['stored' => $stored, 'filename' => mb_substr($name, 0, 120), 'size' => (int)$f['size'], 'type' => $mime, 'label' => $label];
  }
  return $out;
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
  $docs = [];
  if (isset(DOCUMENT_FORMS[$kind])) {
    $docs = accept_documents(DOCUMENT_FORMS[$kind] && $multipart);
    if (DOCUMENT_FORMS[$kind] && !$docs) fail(400, 'Please attach at least one document — your passport, to start with');
    if ($docs) $extra['documents'] = $docs;
  }

  db()->prepare('INSERT INTO submissions (kind, name, email, phone, message, extra) VALUES (?,?,?,?,?,?)')
    ->execute([$kind, $name, $email ?: null, $phone, $message ?: null, $extra ? json_encode($extra, JSON_UNESCAPED_UNICODE) : null]);
  $submissionId = (int)db()->lastInsertId();

  /* the office notice */
  $lines = "Name:        $name\nPhone:       $phone\nEmail:       " . ($email ?: '—') . "\n";
  foreach ($form['extra'] as $key => $label) {
    if (isset($extra[$key])) $lines .= str_pad("$label:", 13) . $extra[$key] . "\n";
  }
  $open = site_url('/admin/submissions?kind=' . $kind . '&open=' . $submissionId);
  $notifyBox = website_mailbox();
  if (!$notifyBox && ($notifyTo = strtolower(trim((string)(cfg()['NOTIFY_EMAIL'] ?? '')))) !== '') $notifyBox = mailbox_by_address($notifyTo);

  if ($notifyBox) {
    /* The website's mailbox is one of ours: file the notice there directly.
       The files stay with the submission, one click away, rather than a
       second copy of every passport going round through the mail. Read in
       the admin's own font, so no column padding. */
    $lines = "Name: $name\nPhone: $phone\nEmail: " . ($email ?: '—') . "\n";
    foreach ($form['extra'] as $key => $label) {
      if (isset($extra[$key])) $lines .= "$label: {$extra[$key]}\n";
    }
    if ($cv) $lines .= "CV: {$cv['filename']}\n";
    if ($docs) {
      $lines .= "\nDocuments (" . count($docs) . "):\n";
      foreach ($docs as $d) $lines .= "· {$d['label']}: {$d['filename']} (" . round($d['size'] / 1024) . " KB)\n";
    }
    deliver_local($notifyBox, [
      'from_email' => $email ?: 'website@' . mail_domain(),
      'from_name' => $name,
      'reply_to' => $email,
      'subject' => "{$form['label']} — $name",
      'text' => "A new {$form['label']} arrived through the website.\n\n$lines\nMessage:\n" . ($message ?: '—') . "\n\n"
        . ($email ? 'Reply here to answer them directly, or ' : 'They left no email — call them back, or ')
        . "open it in the admin: $open",
      'source' => 'form',
      'submission_id' => $submissionId,
    ]);
  } else {
    if ($cv) $lines .= "CV:          {$cv['filename']} (attached)\n";
    /* Documents ride along on the email only while they are small enough for
       every mail server to accept; past that the email lists them and the files
       stay in the admin, which is where they are kept either way. */
    $attach = $cv ? [['path' => cv_dir() . '/' . $cv['stored'], 'filename' => $cv['filename']]] : [];
    if ($docs) {
      $size = array_sum(array_column($docs, 'size'));
      $inline = $size <= 10 * 1024 * 1024;
      $lines .= "\nDocuments (" . count($docs) . ($inline ? ', attached' : ', in the admin — too large to attach') . "):\n";
      foreach ($docs as $d) {
        $lines .= '  · ' . str_pad($d['label'] . ':', 26) . $d['filename'] . ' (' . round($d['size'] / 1024) . " KB)\n";
        if ($inline) $attach[] = ['path' => document_dir() . '/' . $d['stored'], 'filename' => $d['label'] . ' — ' . $d['filename']];
      }
    }
    notify(
      "{$form['label']} — $name",
      "A new {$form['label']} arrived through the website.\n\n$lines\n"
      . 'Message:' . "\n" . ($message ?: '—') . "\n\n"
      . ($email ? 'Reply to this email to answer them directly, or ' : 'Call them back, or ')
      . "open it in the admin: $open",
      $email,
      $attach ? ['attachments' => $attach] : []
    );
  }

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
      'application' => [
        'We received your application and documents — Skyline Travel Solution',
        "Dear $name,\n\nThank you for applying"
        . (isset($extra['destination']) ? " for {$extra['destination']}" : '')
        . ". We have your application and the " . count($docs) . ' document' . (count($docs) === 1 ? '' : 's') . " you sent:\n\n"
        . implode("\n", array_map(fn ($d) => "  · {$d['label']} — {$d['filename']}", $docs))
        . "\n\nA consultant will review your file and contact you about anything still needed. "
        . "You do not need to send these again on Telegram or WhatsApp.\n\nNothing is payable until your visa is approved.",
      ],
    };
    send_mail($email, $ack[0], $ack[1] . $sign, notify_address());
  }

  send(201, ['ok' => true]);
}

/* ---------- delivery events and incoming mail from Resend (Svix-signed) ---------- */

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
    $why = $event['data']['bounce']['message'] ?? $event['data']['bounce']['subType'] ?? null;
    if ($why && $statusMap[$type] === 'bounced') {
      db()->prepare('UPDATE email_log SET error = ? WHERE provider_id = ?')->execute([mb_substr((string)$why, 0, 500), $emailId]);
    }
    /* and on the Sent copy in the mailbox it went from */
    track_delivery((string)$emailId, $statusMap[$type], (array)$event['data']);
  }
  send(200, ['received' => true]);
}

/* ============================================================
   STAFF (admin + editor)
   ============================================================ */

if ($method === 'GET' && $path === '/auth/me') {
  $u = require_staff();
  $st = db()->prepare('SELECT recovery_email, signature FROM users WHERE id = ?');
  $st->execute([$u['id']]);
  $extra = $st->fetch() ?: [];
  send(200, [
    'id' => $u['id'], 'email' => $u['email'], 'name' => $u['name'], 'role' => $u['role'], 'caps' => caps_of($u),
    'recovery_email' => $extra['recovery_email'] ?? null,
    'signature' => user_signature($u),
    'signature_custom' => trim((string)($extra['signature'] ?? '')) !== '',
    'mail_domain' => mail_domain(),
  ]);
}

/* what people set for themselves: the name others see, the private address
   their reset links go to, and the signature under what they write */
if ($method === 'PUT' && $path === '/auth/profile') {
  $u = require_staff();
  $b = body_json();
  if (array_key_exists('name', $b)) {
    $name = clean($b['name'], 120);
    if ($name === '') fail(400, 'Your name is required');
    /* their own mailbox's sender name follows, unless it was set to something else */
    db()->prepare("UPDATE mailboxes SET name = ? WHERE kind = 'personal' AND owner_id = ? AND name = ?")->execute([$name, $u['id'], (string)$u['name']]);
    db()->prepare('UPDATE users SET name = ? WHERE id = ?')->execute([$name, $u['id']]);
  }
  if (array_key_exists('recovery_email', $b)) {
    $r = strtolower(clean($b['recovery_email'], 190));
    if ($r !== '' && !valid_email($r)) fail(400, 'That email address does not look right');
    if ($r !== '' && own_address($r)) fail(400, 'Use a private address, not one at @' . mail_domain() . ' — you need it when you cannot sign in');
    db()->prepare('UPDATE users SET recovery_email = ? WHERE id = ?')->execute([$r ?: null, $u['id']]);
  }
  if (array_key_exists('signature', $b)) {
    $sig = mb_substr(trim(str_replace("\r", '', (string)$b['signature'])), 0, 1000);
    db()->prepare('UPDATE users SET signature = ? WHERE id = ?')->execute([$sig !== '' ? $sig : null, $u['id']]);
  }
  send(200, ['ok' => true]);
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
  /* every other session ends; this one carries on with a fresh token */
  db()->prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?')->execute([hash_password($new), $u['id']]);
  db()->prepare('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL')->execute([$u['id']]);
  $st = db()->prepare('SELECT * FROM users WHERE id = ?');
  $st->execute([$u['id']]);
  send(200, ['ok' => true, 'token' => jwt_sign($st->fetch())]);
}

/* The dashboard, built around the person asking: their mailboxes first, then
   what their role works on. Each block goes only to those allowed to see it —
   an agent's carries no submissions, an editor's no clients. */
if ($method === 'GET' && $path === '/admin/overview') {
  $u = require_staff();
  $out = ['role' => $u['role'], 'caps' => caps_of($u), 'name' => $u['name'], 'email' => $u['email']];

  /* their mailboxes, each with its newest mail */
  $boxes = array_values(array_filter(user_mailboxes($u), fn ($b) => $b['member']));
  $unread = mailbox_unread(array_column($boxes, 'id'));
  $latest = db()->prepare("SELECT id, from_email, from_name, subject, status, source, created_at FROM inbox_messages WHERE mailbox_id = ? AND direction = 'in' AND status IN ('unread','read') ORDER BY created_at DESC, id DESC LIMIT 5");
  foreach ($boxes as &$b) {
    $b['unread'] = $unread[$b['id']] ?? 0;
    $latest->execute([$b['id']]);
    $b['latest'] = array_map(fn ($r) => [
      'id' => (int)$r['id'], 'from' => $r['from_name'] ?: $r['from_email'], 'subject' => $r['subject'],
      'unread' => $r['status'] === 'unread', 'form' => $r['source'] === 'form', 'created_at' => iso($r['created_at']),
    ], $latest->fetchAll());
  }
  unset($b);
  $out['mailboxes'] = $boxes;
  $out['mail_unread'] = array_sum($unread);
  $out['mail_ready'] = ['resend' => (cfg()['RESEND_API_KEY'] ?? '') !== '' || !empty(cfg()['MAIL_DEV_OUTBOX']), 'inbound' => (cfg()['RESEND_WEBHOOK_SECRET'] ?? '') !== ''];

  if (can($u, 'messages')) {
    $forms = [];
    foreach (db()->query('SELECT kind, COUNT(*) AS total, SUM(is_read = 0) AS unread FROM submissions GROUP BY kind') as $r) {
      $forms[$r['kind']] = ['total' => (int)$r['total'], 'unread' => (int)$r['unread']];
    }
    $recent = [];
    foreach (db()->query('SELECT id, kind, name, created_at, is_read FROM submissions ORDER BY created_at DESC LIMIT 6') as $r) {
      $recent[] = ['id' => (int)$r['id'], 'kind' => $r['kind'], 'name' => $r['name'], 'is_read' => (bool)$r['is_read'], 'created_at' => iso($r['created_at'])];
    }
    $out['forms'] = (object)$forms;
    $out['recent'] = $recent;
    $out['mail_failed_7d'] = (int)db()->query("SELECT COUNT(*) FROM email_log WHERE status IN ('failed','bounced','complained') AND created_at > NOW() - INTERVAL 7 DAY")->fetchColumn();
    $out['mail_sent_7d'] = (int)db()->query("SELECT COUNT(*) FROM email_log WHERE created_at > NOW() - INTERVAL 7 DAY")->fetchColumn();
  }
  if (can($u, 'content')) {
    $out['content_updated'] = iso(db()->query('SELECT GREATEST(COALESCE((SELECT MAX(updated_at) FROM content), 0), COALESCE((SELECT MAX(updated_at) FROM items), 0))')->fetchColumn() ?: null);
  }
  if (can($u, 'boards')) {
    /* every count is of the clients this person can see */
    $all = can($u, 'boards_all');
    $boards = [];
    foreach (db()->query('SELECT id, name, settings FROM boards ORDER BY sort, id') as $b) {
      $settings = json_col($b['settings']) ?: [];
      $statusCol = null;
      $cols = db()->prepare("SELECT k, name, settings FROM board_columns WHERE board_id = ? AND type = 'status' ORDER BY k = ? DESC, sort, id LIMIT 1");
      $cols->execute([(int)$b['id'], (string)($settings['kanban_column'] ?? '')]);
      if ($c = $cols->fetch()) $statusCol = ['k' => $c['k'], 'name' => $c['name'], 'labels' => (json_col($c['settings']) ?: [])['labels'] ?? []];

      $items = db()->prepare('SELECT vals FROM board_items WHERE board_id = ? AND archived = 0' . ($all ? '' : ' AND assignee_id = ?'));
      $items->execute($all ? [(int)$b['id']] : [(int)$b['id'], $u['id']]);
      $n = 0;
      $by = [];
      foreach ($items as $it) {
        $n++;
        if ($statusCol) {
          $v = (json_col($it['vals']) ?: [])[$statusCol['k']] ?? '';
          $by[(string)$v] = ($by[(string)$v] ?? 0) + 1;
        }
      }
      $breakdown = [];
      if ($statusCol) {
        foreach ($statusCol['labels'] as $l) {
          if (!empty($by[$l['name']])) $breakdown[] = ['label' => $l['name'], 'color' => $l['color'], 'n' => $by[$l['name']], 'done' => !empty($l['done'])];
        }
        if (!empty($by[''])) $breakdown[] = ['label' => 'No status', 'color' => '#c4c4c4', 'n' => $by[''], 'done' => false];
      }
      $boards[] = ['id' => (int)$b['id'], 'name' => $b['name'], 'items' => $n, 'status' => $statusCol ? $statusCol['name'] : null, 'breakdown' => $breakdown];
    }
    $out['boards'] = $boards;

    /* the clients assigned to them, most recently touched first */
    $mine = [];
    $st = db()->prepare('SELECT i.id, i.name, i.board_id, i.vals, i.updated_at, b.name AS board, b.settings FROM board_items i JOIN boards b ON b.id = i.board_id WHERE i.assignee_id = ? AND i.archived = 0 ORDER BY i.updated_at DESC LIMIT 40');
    $st->execute([$u['id']]);
    $labelsFor = [];
    foreach ($st as $r) {
      $bid = (int)$r['board_id'];
      if (!array_key_exists($bid, $labelsFor)) {
        $settings = json_col($r['settings']) ?: [];
        $c = db()->prepare("SELECT k, settings FROM board_columns WHERE board_id = ? AND type = 'status' ORDER BY k = ? DESC, sort, id LIMIT 1");
        $c->execute([$bid, (string)($settings['kanban_column'] ?? '')]);
        $col = $c->fetch();
        $labelsFor[$bid] = $col ? ['k' => $col['k'], 'labels' => (json_col($col['settings']) ?: [])['labels'] ?? []] : null;
      }
      $status = null;
      if ($labelsFor[$bid]) {
        $v = (json_col($r['vals']) ?: [])[$labelsFor[$bid]['k']] ?? null;
        foreach ($labelsFor[$bid]['labels'] as $l) if ($l['name'] === $v) $status = ['label' => $l['name'], 'color' => $l['color'], 'done' => !empty($l['done'])];
      }
      $mine[] = ['id' => (int)$r['id'], 'name' => $r['name'], 'board_id' => $bid, 'board' => $r['board'], 'status' => $status, 'updated_at' => iso($r['updated_at'])];
    }
    $out['my_items'] = $mine;
  }
  if (can($u, 'team')) {
    $t = db()->query("SELECT COUNT(*) AS n, SUM(is_disabled = 0 AND last_login_at > NOW() - INTERVAL 14 DAY) AS active, SUM(is_disabled = 0 AND last_login_at IS NULL) AS never FROM users")->fetch();
    $out['team'] = ['people' => (int)$t['n'], 'active' => (int)$t['active'], 'never' => (int)$t['never']];
  }
  send(200, $out);
}

/* ---------- content: singletons ---------- */

if (preg_match('#^/admin/content/([^/]+)$#', $path, $m)) {
  $u = require_cap('content');
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
  require_cap('content');
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
  require_cap('content');
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
  require_cap('content');
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
  require_cap('content');
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
  require_cap('content');
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
  require_cap('content');
  $name = basename(rawurldecode($m[1])); // no traversal
  if ($name === '' || $name[0] === '.') fail(400, 'Bad name');
  $target = cfg()['UPLOAD_DIR'] . '/' . $name;
  if (!is_file($target)) fail(404, 'Not found');
  unlink($target);
  send(200, ['ok' => true]);
}

/* ---------- form submissions ---------- */

function present_submission(array $r): array {
  $r['id'] = (int)$r['id'];
  $r['is_read'] = (bool)$r['is_read'];
  $r['extra'] = json_col($r['extra']) ?: (object)[];
  $r['created_at'] = iso($r['created_at']);
  return $r;
}

/* a page of submissions: by form, by a search across who sent it and what
   they wrote, newest first — with the unread counts for the tabs */
if ($method === 'GET' && $path === '/admin/submissions') {
  require_cap('messages');
  $kind = isset(FORMS[$_GET['kind'] ?? '']) ? $_GET['kind'] : null;
  $q = trim((string)($_GET['q'] ?? ''));
  $limit = max(1, min(1000, (int)($_GET['limit'] ?? 50)));
  $offset = max(0, (int)($_GET['offset'] ?? 0));
  $where = [];
  $args = [];
  if ($kind) { $where[] = 'kind = ?'; $args[] = $kind; }
  if ($q !== '') {
    $like = '%' . addcslashes(mb_substr($q, 0, 100), '%_\\') . '%';
    $where[] = '(name LIKE ? OR email LIKE ? OR phone LIKE ? OR message LIKE ? OR extra LIKE ?)';
    array_push($args, $like, $like, $like, $like, $like);
  }
  $sqlWhere = $where ? 'WHERE ' . implode(' AND ', $where) : '';
  $st = db()->prepare("SELECT id, kind, name, email, phone, message, extra, is_read, created_at FROM submissions $sqlWhere ORDER BY created_at DESC, id DESC LIMIT $limit OFFSET $offset");
  $st->execute($args);
  $rows = array_map('present_submission', $st->fetchAll());
  $n = db()->prepare("SELECT COUNT(*) FROM submissions $sqlWhere");
  $n->execute($args);
  $unread = [];
  foreach (db()->query('SELECT kind, SUM(is_read = 0) AS n FROM submissions GROUP BY kind') as $r) $unread[$r['kind']] = (int)$r['n'];
  send(200, ['rows' => $rows, 'total' => (int)$n->fetchColumn(), 'unread' => (object)$unread]);
}

if (preg_match('#^/admin/submissions/(\d+)$#', $path, $m) && $method === 'GET') {
  require_cap('messages');
  $st = db()->prepare('SELECT id, kind, name, email, phone, message, extra, is_read, created_at FROM submissions WHERE id = ?');
  $st->execute([(int)$m[1]]);
  $row = $st->fetch();
  if (!$row) fail(404, 'That submission is gone');
  send(200, present_submission($row));
}

if (preg_match('#^/admin/submissions/(\d+)$#', $path, $m) && in_array($method, ['PUT', 'DELETE'], true)) {
  require_cap('messages');
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
  foreach ((array)($extra['documents'] ?? []) as $d) {
    if (!empty($d['stored'])) @unlink(document_dir() . '/' . basename((string)$d['stored']));
  }
  db()->prepare('DELETE FROM submissions WHERE id = ?')->execute([$id]);
  send(200, ['ok' => true]);
}

/* one applicant document, to signed-in staff only */
if ($method === 'GET' && preg_match('#^/admin/submissions/(\d+)/documents/(\d+)$#', $path, $m)) {
  require_cap('messages');
  $st = db()->prepare('SELECT extra FROM submissions WHERE id = ?');
  $st->execute([(int)$m[1]]);
  $doc = ((json_col($st->fetchColumn() ?: '') ?: [])['documents'] ?? [])[(int)$m[2]] ?? null;
  $file = $doc ? document_dir() . '/' . basename((string)$doc['stored']) : '';
  if (!$doc || !is_file($file)) fail(404, 'Document not found');
  $inline = !empty($_GET['view']) && preg_match('#^(application/pdf|image/(jpeg|png|webp))$#', (string)$doc['type']);
  header('Content-Type: ' . ($doc['type'] ?: 'application/octet-stream'));
  header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename="' . str_replace('"', '', (string)$doc['filename']) . '"');
  header('Content-Length: ' . filesize($file));
  header('Cache-Control: private, no-store');
  header('X-Content-Type-Options: nosniff');
  header("Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  readfile($file);
  exit;
}

/* the CV sits outside the web root: read back only by a signed-in member of staff */
if ($method === 'GET' && preg_match('#^/admin/submissions/(\d+)/cv$#', $path, $m)) {
  require_cap('messages');
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

/* ---------- the email log ---------- */

if ($method === 'GET' && $path === '/admin/emails') {
  require_cap('messages');
  $limit = max(1, min(500, (int)($_GET['limit'] ?? 100)));
  $offset = max(0, (int)($_GET['offset'] ?? 0));
  $where = [];
  $args = [];
  $q = trim((string)($_GET['q'] ?? ''));
  if ($q !== '') {
    $like = '%' . addcslashes(mb_substr($q, 0, 100), '%_\\') . '%';
    $where[] = '(to_email LIKE ? OR subject LIKE ?)';
    array_push($args, $like, $like);
  }
  if (($_GET['status'] ?? '') === 'problems') $where[] = "status IN ('failed','bounced','complained','delayed')";
  $sqlWhere = $where ? 'WHERE ' . implode(' AND ', $where) : '';
  $st = db()->prepare("SELECT id, to_email, subject, provider, status, error, created_at, updated_at FROM email_log $sqlWhere ORDER BY created_at DESC, id DESC LIMIT $limit OFFSET $offset");
  $st->execute($args);
  $rows = [];
  foreach ($st as $r) {
    $r['id'] = (int)$r['id'];
    $r['created_at'] = iso($r['created_at']);
    $r['updated_at'] = iso($r['updated_at']);
    $rows[] = $r;
  }
  $n = db()->prepare("SELECT COUNT(*) FROM email_log $sqlWhere");
  $n->execute($args);
  send(200, ['rows' => $rows, 'total' => (int)$n->fetchColumn()]);
}

if ($method === 'POST' && $path === '/admin/emails/test') {
  $u = require_cap('messages');
  rate_limit('mailtest', 300, 10);
  $to = strtolower(trim((string)(body_json()['to'] ?? '')));
  if (!valid_email($to)) {
    $st = db()->prepare('SELECT recovery_email FROM users WHERE id = ?');
    $st->execute([$u['id']]);
    $to = (string)($st->fetchColumn() ?: $u['email']);
  }
  $r = send_mail($to, 'Skyline test email', "This is a test from the Skyline office admin.\n\nIf you are reading it, outgoing mail works.", notify_address());
  send(200, ['ok' => true, 'to' => $to, 'provider' => 'resend', 'status' => $r['sent'] ? 'sent' : 'failed', 'error' => $r['error']]);
}

/* ============================================================
   ADMIN ONLY — the team
   ============================================================ */

/* a private address for sign-in links: required, and never one of ours */
function recovery_from($raw, bool $required): ?string {
  $r = strtolower(clean($raw ?? '', 190));
  if ($r === '') {
    if ($required) fail(400, 'Add their private email — the link to choose a password goes there');
    return null;
  }
  if (!valid_email($r)) fail(400, 'That private email does not look right');
  if (own_address($r)) fail(400, 'The private email must be outside @' . mail_domain() . ' — it is how they get back in when they cannot sign in');
  return $r;
}

function address_taken(string $address, int $exceptUser = 0): bool {
  $st = db()->prepare('SELECT COUNT(*) FROM users WHERE email = ? AND id != ?');
  $st->execute([$address, $exceptUser]);
  if ((int)$st->fetchColumn()) return true;
  $box = mailbox_by_address($address);
  return $box && !($box['kind'] === 'personal' && $box['owner_id'] === $exceptUser);
}

if ($method === 'GET' && $path === '/admin/users') {
  require_admin();
  $rows = [];
  foreach (db()->query('SELECT id, email, recovery_email, name, role, is_disabled, created_at, last_login_at FROM users ORDER BY created_at') as $r) {
    $r['id'] = (int)$r['id'];
    $r['is_disabled'] = (bool)$r['is_disabled'];
    $r['own_address'] = own_address((string)$r['email']);
    $r['created_at'] = iso($r['created_at']);
    $r['last_login_at'] = iso($r['last_login_at']);
    $rows[] = $r;
  }
  send(200, ['users' => $rows, 'domain' => mail_domain()]);
}

/* A new colleague: their address at the office's domain (their sign-in and
   their own mailbox), and a private one for the link to choose a password —
   no password is ever emailed. */
if ($method === 'POST' && $path === '/admin/users') {
  require_admin();
  $b = body_json();
  $email = own_address_from((string)($b['address'] ?? $b['email'] ?? ''));
  if ($email === '') fail(400, 'Choose their address at @' . mail_domain() . ' — letters, numbers, dots and dashes');
  if (address_taken($email)) fail(409, "$email is already in use");
  $name = clean($b['name'] ?? '', 120);
  if ($name === '') fail(400, 'Their name is required');
  $role = in_array($b['role'] ?? '', ROLES, true) ? $b['role'] : 'agent';
  $recovery = recovery_from($b['recovery_email'] ?? '', true);
  db()->prepare('INSERT INTO users (email, recovery_email, name, password_hash, role) VALUES (?,?,?,?,?)')
    ->execute([$email, $recovery, $name, hash_password(bin2hex(random_bytes(24))), $role]);
  $id = (int)db()->lastInsertId();
  ensure_personal_mailbox($id);
  $sent = send_reset_link(['id' => $id, 'email' => $email, 'recovery_email' => $recovery, 'name' => $name], 72 * 3600, true);
  send(201, ['id' => $id, 'email' => $email, 'invited' => $sent]);
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
  $recovery = array_key_exists('recovery_email', $b) ? recovery_from($b['recovery_email'], false) : $user['recovery_email'];
  if ($id === $me['id'] && ($disabled || $role !== 'admin')) fail(400, 'You cannot lock yourself out — ask another admin');
  /* the team must always keep one working admin */
  if ($user['role'] === 'admin' && ($role !== 'admin' || $disabled)) {
    $n = (int)db()->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_disabled = 0")->fetchColumn();
    if ($n <= 1) fail(400, 'This is the only admin — make someone else an admin first');
  }

  /* a new sign-in address takes their own mailbox with it; an old private
     one becomes their reset address, so they are never left without one */
  $email = $user['email'];
  if (array_key_exists('address', $b)) {
    $new = own_address_from((string)$b['address']);
    if ($new === '') fail(400, 'Choose an address at @' . mail_domain());
    if ($new !== $email) {
      if (address_taken($new, $id)) fail(409, "$new is already in use");
      $box = mailbox_by_address($email);
      if ($box && $box['kind'] === 'personal' && $box['owner_id'] === $id) {
        db()->prepare('UPDATE mailboxes SET address = ? WHERE id = ?')->execute([$new, $box['id']]);
      }
      if (!own_address($email) && !$recovery) $recovery = $email;
      $email = $new;
    }
  }
  if ($name && $name !== $user['name']) {
    db()->prepare("UPDATE mailboxes SET name = ? WHERE kind = 'personal' AND owner_id = ? AND name = ?")->execute([$name, $id, (string)$user['name']]);
  }
  db()->prepare('UPDATE users SET email = ?, recovery_email = ?, role = ?, is_disabled = ?, name = ? WHERE id = ?')
    ->execute([$email, $recovery, $role, $disabled ? 1 : 0, $name ?: null, $id]);
  if ($disabled) db()->prepare('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL')->execute([$id]);
  ensure_personal_mailbox($id);
  send(200, ['ok' => true, 'email' => $email]);
}

if (preg_match('#^/admin/users/(\d+)/invite$#', $path, $m) && $method === 'POST') {
  require_admin();
  $st = db()->prepare('SELECT id, email, recovery_email, name FROM users WHERE id = ? AND is_disabled = 0');
  $st->execute([(int)$m[1]]);
  $user = $st->fetch();
  if (!$user) fail(404, 'Not found');
  if (reset_destination($user) === '') fail(400, 'Add their private email first — the link cannot go to a mailbox inside the admin');
  if (!send_reset_link($user, 72 * 3600, true)) fail(502, 'The email could not be sent — see the email log');
  send(200, ['ok' => true, 'to' => reset_destination($user)]);
}

/* the office's mailboxes: reading, sending, setting them up */
require __DIR__ . '/mailbox.php';

/* the work boards: clients, applications, pre-enrolment */
require __DIR__ . '/boards.php';

fail(404, 'Not found');
