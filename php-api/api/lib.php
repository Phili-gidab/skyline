<?php
/*
 * Skyline API — shared helpers.
 *
 * Adapted from the RTG API (the rtgeth project's php-api), which has run on
 * cPanel shared hosting in production. Zero dependencies: PDO MySQL, a
 * hand-rolled HS256 JWT, bcrypt via password_hash, curl for Resend.
 *
 * The config file lives OUTSIDE the web root as ~/skyline-api-config.php,
 * one level above public_html. See php-api/config.example.php.
 */

declare(strict_types=1);

function cfg(): array {
  static $cfg = null;
  if ($cfg !== null) return $cfg;
  $candidates = [
    dirname($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__, 2)) . '/skyline-api-config.php',
    dirname(__DIR__, 3) . '/skyline-api-config.php',
    dirname(__DIR__) . '/config.php', // local dev fallback
  ];
  foreach ($candidates as $p) {
    if (is_file($p)) { $cfg = require $p; return $cfg; }
  }
  http_response_code(500);
  header('Content-Type: application/json');
  echo '{"error":"API not configured"}';
  exit;
}

function db(): PDO {
  static $pdo = null;
  if ($pdo !== null) return $pdo;
  $c = cfg();
  $pdo = connect_db($c);
  return $pdo;
}

function connect_db(array $c): PDO {
  $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
    $c['DB_HOST'] ?? '127.0.0.1', (int)($c['DB_PORT'] ?? 3306), $c['DB_NAME']);
  return new PDO($dsn, $c['DB_USER'], $c['DB_PASSWORD'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false, // native types: INT columns come back as ints
  ]);
}

/* ---------- responses ---------- */

function send(int $status, $data, array $headers = []): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('X-Content-Type-Options: nosniff');
  foreach ($headers as $k => $v) header("$k: $v");
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function fail(int $status, string $msg): void { send($status, ['error' => $msg]); }

function body_json(): array {
  $raw = file_get_contents('php://input');
  $data = json_decode($raw ?: '', true);
  return is_array($data) ? $data : [];
}

function iso(?string $ts): ?string { return $ts ? date('c', strtotime($ts)) : null; }

/* one line of user input, trimmed and capped */
function clean($v, int $max): string {
  $s = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string)$v) ?? '');
  return mb_substr($s, 0, $max);
}

function valid_email(string $e): bool {
  return (bool)filter_var($e, FILTER_VALIDATE_EMAIL) && mb_strlen($e) <= 190;
}

function json_col($v) { return is_string($v) ? json_decode($v, true) : $v; }

function valid_key(string $k): bool { return (bool)preg_match('/^[a-z][a-z0-9_-]{1,63}$/', $k); }

/* ---------- auth (JWT HS256) ---------- */

function b64url_encode(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function b64url_decode(string $s): string|false { return base64_decode(strtr($s, '-_', '+/')); }

function jwt_sign(array $user): string {
  $c = cfg();
  $header = b64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
  $now = time();
  $payload = b64url_encode(json_encode([
    'sub' => (int)$user['id'], 'email' => $user['email'], 'role' => $user['role'],
    'iat' => $now, 'exp' => $now + 12 * 3600,
  ]));
  $sig = b64url_encode(hash_hmac('sha256', "$header.$payload", $c['JWT_SECRET'], true));
  return "$header.$payload.$sig";
}

function jwt_verify(string $token): ?array {
  $c = cfg();
  $parts = explode('.', $token);
  if (count($parts) !== 3) return null;
  [$header, $payload, $sig] = $parts;
  $expected = b64url_encode(hash_hmac('sha256', "$header.$payload", $c['JWT_SECRET'], true));
  if (!hash_equals($expected, $sig)) return null;
  $data = json_decode(b64url_decode($payload) ?: '', true);
  if (!is_array($data) || !isset($data['exp']) || $data['exp'] < time()) return null;
  return $data;
}

function bearer_token(): ?string {
  $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
  if (!$h && function_exists('getallheaders')) {
    foreach (getallheaders() as $k => $v) if (strcasecmp($k, 'Authorization') === 0) { $h = $v; break; }
  }
  return str_starts_with($h, 'Bearer ') ? substr($h, 7) : null;
}

const ROLES = ['admin', 'editor'];

/* Any signed-in staff member. The token says who they are; the database says
   whether they still may — so disabling someone, or changing their role,
   takes effect on their very next request rather than when the token expires. */
function require_staff(): array {
  $token = bearer_token();
  if (!$token) fail(401, 'Not signed in');
  $payload = jwt_verify($token);
  if (!$payload) fail(401, 'Session expired — sign in again');
  $st = db()->prepare('SELECT id, email, name, role, is_disabled FROM users WHERE id = ?');
  $st->execute([(int)$payload['sub']]);
  $user = $st->fetch();
  if (!$user || (int)$user['is_disabled'] === 1 || !in_array($user['role'], ROLES, true)) {
    fail(401, 'This account can no longer sign in');
  }
  $user['id'] = (int)$user['id'];
  return $user;
}

/* admins manage the team; editors run the content and the inbox */
function require_admin(): array {
  $user = require_staff();
  if ($user['role'] !== 'admin') fail(403, 'Only an administrator can do that');
  return $user;
}

function hash_password(string $pw): string {
  return password_hash($pw, PASSWORD_BCRYPT, ['cost' => 11]);
}

/* ---------- rate limiting (fixed window, file-based) ---------- */

function private_dir(string $sub = ''): string {
  $base = rtrim((string)(cfg()['PRIVATE_DIR'] ?? (sys_get_temp_dir() . '/skyline-private')), '/');
  $dir = $sub === '' ? $base : "$base/$sub";
  if (!is_dir($dir)) @mkdir($dir, 0700, true);
  return $dir;
}

function rate_limit(string $bucket, int $windowSec, int $max): void {
  $ip = $_SERVER['REMOTE_ADDR'] ?? '0';
  $file = private_dir('rate') . '/' . md5("$ip:$bucket") . '.json';
  $fh = @fopen($file, 'c+');
  if (!$fh) return; // limiter storage unavailable: let the request through rather than lock everyone out
  flock($fh, LOCK_EX);
  $entry = json_decode(stream_get_contents($fh) ?: '', true) ?: null;
  $now = time();
  if (!$entry || $now - $entry['start'] > $windowSec) $entry = ['start' => $now, 'count' => 1];
  else $entry['count']++;
  ftruncate($fh, 0); rewind($fh);
  fwrite($fh, json_encode($entry));
  flock($fh, LOCK_UN); fclose($fh);
  if ($entry['count'] > $max) fail(429, 'Too many requests — try again shortly');
}

/* ---------- origins ---------- */

function site_origins(): array {
  return array_values(array_filter(array_map('trim', explode(',', cfg()['SITE_ORIGIN'] ?? ''))));
}

function site_url(string $path = ''): string {
  return rtrim(site_origins()[0] ?? 'https://skyline-et.com', '/') . $path;
}

/* Same-origin in production; kept for the www./bare-domain pair and local dev. */
function apply_cors(): void {
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  if ($origin && in_array($origin, site_origins(), true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
  }
  if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
}

/* ---------- content ---------- */

function content_single(string $key): array {
  try {
    $st = db()->prepare('SELECT data FROM content WHERE k = ?');
    $st->execute([$key]);
    $row = $st->fetch();
    return $row ? (json_col($row['data']) ?: []) : [];
  } catch (Throwable $e) {
    return [];
  }
}

/* the office's contact block, as edited in the admin, with safe fallbacks */
function brand(): array {
  return array_merge([
    'name' => 'Skyline Travel Solution',
    'address' => '22 Bole Road, Bimmer, Office 704',
    'landmark' => 'In front of Awaris Hotel',
    'whatsapp' => '+251 921 470 395',
  ], array_filter(content_single('brand'), fn ($v) => is_string($v) && $v !== ''));
}

/* ---------- outgoing mail ----------
 * Three ways out, tried in order: Resend's API (preferred — DKIM-signed,
 * delivery reported back by webhook), authenticated SMTP through the office's
 * own cPanel mailbox, then PHP mail() as the last resort. Every attempt is
 * written to email_log so the office can see what the site sent and whether
 * it arrived. Sending never throws: a mail failure must not lose a form.
 */

/* Speaks just enough SMTP to hand a message to the office mailbox, so mail
   leaves as office@skyline-et.com with SPF/DKIM that match the domain. */
function smtp_send(string $to, string $encSubject, string $body, string $headers, array $c): bool {
  $host = (string)($c['SMTP_HOST'] ?? '');
  $user = (string)($c['SMTP_USER'] ?? '');
  $pass = (string)($c['SMTP_PASS'] ?? '');
  if ($host === '' || $user === '' || $pass === '') return false;
  $port = (int)($c['SMTP_PORT'] ?? 465);
  $secure = $c['SMTP_SECURE'] ?? 'ssl';                 // 'ssl' (465), 'tls' (587), 'none' (local dev only)
  $from = (string)($c['MAIL_FROM'] ?? $user);
  $dsn = ($secure === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;

  $fp = @stream_socket_client($dsn, $errno, $errstr, 20);
  if (!$fp) { error_log("Skyline SMTP: connect failed $dsn ($errstr)"); return false; }
  stream_set_timeout($fp, 20);

  $read = function () use ($fp) {
    $data = '';
    while (($line = fgets($fp, 600)) !== false) {
      $data .= $line;
      if (strlen($line) < 4 || $line[3] === ' ') break;
    }
    return $data;
  };
  $cmd = function (string $line) use ($fp, $read) { fwrite($fp, "$line\r\n"); return $read(); };
  $ok = fn(string $r, string $code) => str_starts_with(ltrim($r), $code);

  $read();
  $ehlo = 'EHLO ' . (parse_url(site_url(), PHP_URL_HOST) ?: 'skyline-et.com');
  $cmd($ehlo);
  if ($secure === 'tls') {
    if (!$ok($cmd('STARTTLS'), '220') || !stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
      fclose($fp); error_log('Skyline SMTP: STARTTLS failed'); return false;
    }
    $cmd($ehlo);
  }
  $cmd('AUTH LOGIN');
  $cmd(base64_encode($user));
  if (!$ok($cmd(base64_encode($pass)), '235')) { fclose($fp); error_log('Skyline SMTP: authentication rejected'); return false; }
  if (!$ok($cmd("MAIL FROM:<$from>"), '250')) { fclose($fp); error_log('Skyline SMTP: sender rejected'); return false; }
  if (!$ok($cmd("RCPT TO:<$to>"), '2')) { fclose($fp); error_log("Skyline SMTP: recipient $to rejected"); return false; }
  if (!$ok($cmd('DATA'), '354')) { fclose($fp); return false; }

  /* SMTP wants CRLF endings. One regex, not str_replace with an array: that
     runs its replacements one after another, so a CRLF already in the body
     (every MIME part has them) came out as CR CR LF CR LF and the attachment
     boundaries broke. Dot-stuffing keeps a lone "." from ending the message. */
  $safeBody = preg_replace('/^\./m', '..', preg_replace("/\r\n|\r|\n/", "\r\n", $body));
  $message = "To: $to\r\nSubject: $encSubject\r\nDate: " . date('r') . "\r\n$headers\r\n$safeBody\r\n.";
  $sent = $ok($cmd($message), '250');
  $cmd('QUIT');
  fclose($fp);
  if (!$sent) error_log("Skyline SMTP: server refused the message to $to");
  return $sent;
}

function mail_from(): array {
  $c = cfg();
  $host = parse_url(site_url(), PHP_URL_HOST) ?: 'skyline-et.com';
  return [$c['MAIL_FROM'] ?? "office@$host", $c['MAIL_FROM_NAME'] ?? 'Skyline Travel Solution'];
}

/* plain text → the site's look: white page, deep emerald band, emerald accent */
function mail_html(string $subject, string $body): string {
  $esc = fn ($s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
  $b = brand();
  $paras = '';
  foreach (preg_split('/\n{2,}/', trim($body)) as $p) {
    $paras .= '<p style="margin:0 0 16px;font:16px/1.6 Helvetica,Arial,sans-serif;color:#0d1d16">'
      . nl2br($esc($p)) . '</p>';
  }
  $host = parse_url(site_url(), PHP_URL_HOST) ?: 'skyline-et.com';
  return '<!doctype html><html><body style="margin:0;background:#f3f7f4;padding:28px 16px">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">'
    . '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid rgba(13,29,22,.12)">'
    . '<tr><td style="background:#0b3a26;padding:20px 28px">'
    . '<span style="font:700 18px/1 Helvetica,Arial,sans-serif;letter-spacing:.08em;color:#f2f9f5;text-transform:uppercase">Skyline Travel Solution</span>'
    . '<br><span style="font:italic 14px/1.8 Georgia,serif;color:#7fdca6">You Belong Everywhere</span>'
    . '</td></tr>'
    . '<tr><td style="padding:28px">'
    . '<h1 style="margin:0 0 18px;font:700 21px/1.25 Helvetica,Arial,sans-serif;color:#0b7d3f">' . $esc($subject) . '</h1>'
    . $paras
    . '</td></tr>'
    . '<tr><td style="padding:16px 28px;border-top:1px solid rgba(13,29,22,.12);font:12px/1.7 Helvetica,Arial,sans-serif;color:#587064">'
    . $esc($b['address']) . ' · ' . $esc($b['landmark']) . '<br>'
    . 'WhatsApp ' . $esc($b['whatsapp']) . ' · <a href="' . $esc(site_url()) . '" style="color:#0b7d3f">' . $esc($host) . '</a>'
    . '</td></tr></table></td></tr></table></body></html>';
}

function log_mail(string $to, string $subject, string $provider, string $status, ?string $providerId = null, ?string $error = null): void {
  try {
    db()->prepare('INSERT INTO email_log (to_email, subject, provider, status, provider_id, error) VALUES (?,?,?,?,?,?)')
      ->execute([mb_substr($to, 0, 190), mb_substr($subject, 0, 255), $provider, $status, $providerId, $error ? mb_substr($error, 0, 500) : null]);
  } catch (Throwable $e) {
    error_log('Skyline API: email_log write failed — ' . $e->getMessage());
  }
}

function resend_send(string $to, string $subject, string $text, string $replyTo, array $c, array $opts = []): array {
  $key = $c['RESEND_API_KEY'] ?? '';
  if ($key === '') return ['sent' => false, 'id' => null, 'error' => null];
  [$from, $fromName] = mail_from();
  $payload = [
    'from' => "$fromName <$from>",
    'to' => [$to],
    'subject' => $subject,
    'text' => $text,
    'html' => mail_html($subject, $text),
  ];
  if ($replyTo && valid_email($replyTo)) $payload['reply_to'] = $replyTo;
  if (!empty($opts['headers']) && is_array($opts['headers'])) $payload['headers'] = $opts['headers'];

  /* files travel base64 inside the JSON — a shared host dies long before
     Resend's own 40 MB limit, so each file is capped at 8 MB */
  foreach ($opts['attachments'] ?? [] as $a) {
    $path = $a['path'] ?? '';
    if (!is_file($path) || filesize($path) > 8 * 1024 * 1024) continue;
    $payload['attachments'][] = [
      'filename' => $a['filename'] ?? basename($path),
      'content' => base64_encode((string)file_get_contents($path)),
    ];
  }

  $ch = curl_init('https://api.resend.com/emails');
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', "Authorization: Bearer $key"],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
  ]);
  $raw = curl_exec($ch);
  $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  $curlErr = curl_error($ch);
  curl_close($ch);
  $body = json_decode($raw ?: '', true);
  if ($status >= 200 && $status < 300 && !empty($body['id'])) {
    return ['sent' => true, 'id' => $body['id'], 'error' => null];
  }
  return ['sent' => false, 'id' => null, 'error' => $body['message'] ?? ($curlErr ?: "HTTP $status")];
}

/* the SMTP and mail() routes carry attachments as a hand-built MIME body */
function mime_body(string $text, array $attachments, string &$contentType): string {
  $files = [];
  foreach ($attachments as $a) {
    $path = $a['path'] ?? '';
    if (is_file($path) && filesize($path) <= 8 * 1024 * 1024) $files[] = $a;
  }
  if (!$files) { $contentType = 'text/plain; charset=UTF-8'; return $text; }
  $boundary = 'sky_' . bin2hex(random_bytes(12));
  $contentType = "multipart/mixed; boundary=\"$boundary\"";
  $out = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n$text\r\n";
  foreach ($files as $a) {
    $name = str_replace(['"', "\r", "\n"], '', (string)($a['filename'] ?? basename($a['path'])));
    $out .= "--$boundary\r\nContent-Type: application/octet-stream; name=\"$name\"\r\n"
      . "Content-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"$name\"\r\n\r\n"
      . chunk_split(base64_encode((string)file_get_contents($a['path']))) . "\r\n";
  }
  return $out . "--$boundary--";
}

function send_mail(string $to, string $subject, string $body, string $replyTo = '', array $opts = []): void {
  if (!valid_email($to)) return;
  $c = cfg();
  [$from, $fromName] = mail_from();

  /* 1. Resend */
  $r = resend_send($to, $subject, $body, $replyTo, $c, $opts);
  if ($r['sent']) { log_mail($to, $subject, 'resend', 'sent', $r['id']); return; }
  $firstError = $r['error'];

  /* 2. authenticated SMTP through the office mailbox */
  $contentType = '';
  $mime = mime_body($body, $opts['attachments'] ?? [], $contentType);
  $headers = "From: $fromName <$from>\r\n";
  if ($replyTo && valid_email($replyTo)) $headers .= "Reply-To: $replyTo\r\n";
  foreach (($opts['headers'] ?? []) as $k => $v) {
    if (preg_match('/^[A-Za-z-]+$/', (string)$k)) $headers .= "$k: " . str_replace(["\r", "\n"], '', (string)$v) . "\r\n";
  }
  $headers .= "MIME-Version: 1.0\r\nContent-Type: $contentType\r\n";
  $encSubject = '=?UTF-8?B?' . base64_encode(str_replace(["\r", "\n"], ' ', $subject)) . '?=';
  if (smtp_send($to, $encSubject, $mime, $headers, $c)) { log_mail($to, $subject, 'smtp', 'sent'); return; }

  /* 3. local sendmail */
  if (@mail($to, $encSubject, $mime, $headers)) { log_mail($to, $subject, 'mail', 'sent'); return; }

  log_mail($to, $subject, 'none', 'failed', null, $firstError ?: 'all transports failed');
  error_log("Skyline API: mail to $to failed ($subject)" . ($firstError ? " — $firstError" : ''));
}

function notify(string $subject, string $body, string $replyTo = '', array $opts = []): void {
  $to = cfg()['NOTIFY_EMAIL'] ?? '';
  if ($to) send_mail($to, $subject, $body, $replyTo, $opts);
}

/* ---------- images ---------- */

/* web images get resized to a sane width — an 8 MB phone photo must not land on the page */
function shrink_image(string $path, string $mime, int $maxW = 1600): void {
  if (!function_exists('imagecreatefromjpeg')) return; // no GD: keep the original
  $info = @getimagesize($path);
  if (!$info) return;
  [$w, $h] = $info;
  if ($w * $h > 40_000_000) return; // absurd pixel counts would exhaust shared-hosting memory
  if ($w <= $maxW) return;
  $src = match ($mime) {
    'image/jpeg' => @imagecreatefromjpeg($path),
    'image/png' => @imagecreatefrompng($path),
    'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : null,
    default => null,
  };
  if (!$src) return;
  $dst = imagescale($src, $maxW);
  imagedestroy($src);
  if (!$dst) return;
  match ($mime) {
    'image/jpeg' => imagejpeg($dst, $path, 84),
    'image/png' => imagepng($dst, $path, 8),
    'image/webp' => imagewebp($dst, $path, 84),
  };
  imagedestroy($dst);
}
