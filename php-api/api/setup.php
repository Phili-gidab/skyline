<?php
/*
 * Install / upgrade: the schema, the first admin, and the site's current
 * content as the starting point for editing. Shared by the command line
 * (php-api/seed.php) and the browser (POST /api/setup).
 *
 * Idempotent: tables use IF NOT EXISTS, an existing admin's password is never
 * changed, singletons are never overwritten, and a collection is filled only
 * while it is empty — so live edits always survive a re-run.
 */

declare(strict_types=1);

function run_setup(PDO $pdo, array $cfg): array {
  $log = [];

  $schema = (string)file_get_contents(__DIR__ . '/schema.sql');
  $schema = preg_replace('/^\s*--.*$/m', '', $schema); // comment lines only; the statements stay
  foreach (array_filter(array_map('trim', explode(';', $schema))) as $stmt) {
    $pdo->exec($stmt);
  }
  $log[] = 'Schema applied';

  $email = strtolower(trim((string)($cfg['ADMIN_EMAIL'] ?? '')));
  $password = (string)($cfg['ADMIN_PASSWORD'] ?? '');
  if ($email !== '' && strlen($password) >= 10) {
    $pdo->prepare("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'admin') ON DUPLICATE KEY UPDATE email = email")
      ->execute([$email, 'Administrator', password_hash($password, PASSWORD_BCRYPT, ['cost' => 11])]);
    $log[] = "Admin ensured: $email";
  } elseif ($email !== '') {
    $log[] = 'Admin NOT created: ADMIN_PASSWORD must be at least 10 characters';
  }

  $seed = json_decode((string)file_get_contents(__DIR__ . '/seed-data.json'), true) ?: ['singles' => [], 'collections' => []];
  foreach ($seed['singles'] as $k => $data) {
    $pdo->prepare('INSERT INTO content (k, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE k = k')
      ->execute([$k, json_encode($data, JSON_UNESCAPED_UNICODE)]);
  }
  $log[] = 'Sections ensured: ' . implode(', ', array_keys($seed['singles']));

  foreach ($seed['collections'] as $collection => $rows) {
    $st = $pdo->prepare('SELECT COUNT(*) FROM items WHERE collection = ?');
    $st->execute([$collection]);
    $n = (int)$st->fetchColumn();
    if ($n > 0) { $log[] = "Kept $collection ($n items)"; continue; }
    $ins = $pdo->prepare('INSERT INTO items (collection, data, sort) VALUES (?, ?, ?)');
    foreach (array_values($rows) as $i => $row) $ins->execute([$collection, json_encode($row, JSON_UNESCAPED_UNICODE), $i + 1]);
    $log[] = "Loaded $collection: " . count($rows);
  }
  return $log;
}
