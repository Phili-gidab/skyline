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
    (string)getenv('SKYLINE_CONFIG'), // command-line tools say where it is
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

const ROLES = ['admin', 'manager', 'agent', 'frontdesk', 'editor'];

/* What each role may do. Checked on the server for every request — the admin
   hiding a menu item is a convenience, never the protection. */
const CAPS = [
  'content'    => ['admin', 'manager', 'editor'],             // website sections, lists, media
  'messages'   => ['admin', 'manager', 'frontdesk'],          // submissions, mailbox, email log
  'boards'     => ['admin', 'manager', 'agent', 'frontdesk'], // the client boards at all
  'boards_all' => ['admin', 'manager', 'frontdesk'],          // every client, not only their own
  'money'      => ['admin', 'manager'],                       // prepayments, fees
  'secrets_all'=> ['admin'],                                  // every client's passwords (agents: own clients only)
  'configure'  => ['admin'],                                  // board columns, groups, statuses
  'team'       => ['admin'],
];

function can(array $user, string $cap): bool {
  return in_array($user['role'], CAPS[$cap] ?? [], true);
}

function caps_of(array $user): array {
  return array_values(array_filter(array_keys(CAPS), fn ($c) => can($user, $c)));
}

function require_cap(string $cap): array {
  $user = require_staff();
  if (!can($user, $cap)) fail(403, 'Your role does not allow that');
  return $user;
}

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

/* ---------- sealed secrets (clients' portal passwords) ----------
   AES-256-GCM with a key that lives only in the config file outside the web
   root. A database dump alone reveals nothing; the tag means a tampered value
   fails to open rather than decrypting to garbage. */

function secrets_key(): string {
  $k = base64_decode((string)(cfg()['SECRETS_KEY'] ?? ''), true);
  if ($k === false || strlen($k) !== 32) fail(500, 'SECRETS_KEY is not configured on the server');
  return $k;
}

function seal(string $plain): string {
  $iv = random_bytes(12);
  $tag = '';
  $ct = openssl_encrypt($plain, 'aes-256-gcm', secrets_key(), OPENSSL_RAW_DATA, $iv, $tag);
  if ($ct === false) fail(500, 'Could not encrypt');
  return 'v1:' . base64_encode($iv . $tag . $ct);
}

function unseal(string $sealed): string {
  if (!str_starts_with($sealed, 'v1:')) fail(500, 'Unknown secret format');
  $raw = base64_decode(substr($sealed, 3), true) ?: '';
  $plain = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', secrets_key(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
  if ($plain === false) fail(500, 'Could not decrypt — the key may have changed');
  return $plain;
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
 * One way out: Resend's API. Mail is DKIM-signed for skyline-et.com and its
 * delivery is reported back by webhook. There is deliberately no fallback —
 * a failure is written to email_log with Resend's own reason, where the
 * office can see it, rather than the mail quietly leaving some other way.
 * Sending never throws: a mail failure must not lose a form.
 */

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

function send_mail(string $to, string $subject, string $body, string $replyTo = '', array $opts = []): void {
  if (!valid_email($to)) return;
  $r = resend_send($to, $subject, $body, $replyTo, cfg(), $opts);
  if ($r['sent']) { log_mail($to, $subject, 'resend', 'sent', $r['id']); return; }
  $why = $r['error'] ?: 'RESEND_API_KEY is not set';
  log_mail($to, $subject, 'resend', 'failed', null, $why);
  error_log("Skyline API: mail to $to failed ($subject) — $why");
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
