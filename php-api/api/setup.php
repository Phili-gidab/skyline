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
  array_push($log, ...run_migrations($pdo));

  /* The first administrator, from the config — only while there is none.
     Once the team exists it is managed in the admin, and an address that has
     since changed (or become someone's reset address) is never re-created. */
  $email = strtolower(trim((string)($cfg['ADMIN_EMAIL'] ?? '')));
  $password = (string)($cfg['ADMIN_PASSWORD'] ?? '');
  $admins = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn();
  $known = $pdo->prepare('SELECT COUNT(*) FROM users WHERE email = ? OR recovery_email = ?');
  $known->execute([$email, $email]);
  if ($admins > 0 || (int)$known->fetchColumn() > 0) {
    $log[] = 'Admin: already set up';
  } elseif ($email !== '' && strlen($password) >= 10) {
    $pdo->prepare("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'admin')")
      ->execute([$email, 'Administrator', password_hash($password, PASSWORD_BCRYPT, ['cost' => 11])]);
    $log[] = "Admin created: $email";
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
  array_push($log, ...seed_mailboxes($pdo, $cfg));
  return $log;
}

function column_exists(PDO $pdo, string $table, string $column): bool {
  $st = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?');
  $st->execute([$table, $column]);
  return (int)$st->fetchColumn() > 0;
}

function index_exists(PDO $pdo, string $table, string $index): bool {
  $st = $pdo->prepare('SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?');
  $st->execute([$table, $index]);
  return (int)$st->fetchColumn() > 0;
}

/* Columns and indexes added since a database was first installed. MySQL 8
   has no ADD COLUMN IF NOT EXISTS (MariaDB does), so each is checked first. */
function run_migrations(PDO $pdo): array {
  $log = [];
  $columns = [
    ['users', 'recovery_email', 'VARCHAR(190) NULL AFTER email'],
    ['users', 'signature', 'TEXT NULL AFTER name'],
    ['users', 'token_version', 'INT NOT NULL DEFAULT 0 AFTER is_disabled'],
    ['inbox_messages', 'mailbox_id', 'INT NULL AFTER id'],
    ['inbox_messages', 'reply_to', 'VARCHAR(190) NULL AFTER cc_email'],
    ['inbox_messages', 'auth', 'VARCHAR(80) NULL AFTER in_reply_to'],
    ['inbox_messages', 'source', 'VARCHAR(20) NULL AFTER auth'],
    ['inbox_messages', 'submission_id', 'INT NULL AFTER source'],
    ['inbox_messages', 'delivery', 'VARCHAR(20) NULL AFTER submission_id'],
    ['inbox_messages', 'sent_by', 'INT NULL AFTER delivery'],
    ['mailboxes', 'website', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER catch_all'],
  ];
  foreach ($columns as [$table, $column, $def]) {
    if (column_exists($pdo, $table, $column)) continue;
    $pdo->exec("ALTER TABLE $table ADD COLUMN $column $def");
    $log[] = "Added $table.$column";
  }
  /* one inbox became many: a message is unique per mailbox now, not overall */
  if (index_exists($pdo, 'inbox_messages', 'uniq_message')) {
    $pdo->exec('ALTER TABLE inbox_messages DROP INDEX uniq_message');
    $log[] = 'Dropped inbox_messages.uniq_message';
  }
  $indexes = [
    ['inbox_messages', 'uniq_box_resend', 'ADD UNIQUE KEY uniq_box_resend (mailbox_id, resend_id)'],
    ['inbox_messages', 'idx_mailbox', 'ADD INDEX idx_mailbox (mailbox_id, direction, status, created_at)'],
    ['inbox_messages', 'idx_message', 'ADD INDEX idx_message (message_id)'],
    ['inbox_messages', 'idx_resend', 'ADD INDEX idx_resend (resend_id)'],
  ];
  foreach ($indexes as [$table, $index, $def]) {
    if (index_exists($pdo, $table, $index)) continue;
    $pdo->exec("ALTER TABLE $table $def");
    $log[] = "Added index $table.$index";
  }
  /* the first inbox kept Resend's id where the real Message-ID belongs */
  $n = $pdo->exec("UPDATE inbox_messages SET message_id = NULL WHERE direction = 'in' AND resend_id IS NOT NULL AND message_id NOT LIKE '%@%'");
  if ($n) $log[] = "Cleared $n stand-in Message-IDs";
  return $log;
}

/* The mailboxes, once: a personal box for everyone who already signs in at
   the domain, the two shared ones, and a catch-all. Then any mail from the
   single inbox that came before is filed into the box it was addressed to. */
function seed_mailboxes(PDO $pdo, array $cfg): array {
  $domain = strtolower(trim((string)($cfg['MAIL_DOMAIN'] ?? '')));
  if ($domain === '') {
    $from = strtolower((string)($cfg['MAIL_FROM'] ?? ''));
    $domain = str_contains($from, '@') ? substr($from, strrpos($from, '@') + 1) : '';
  }
  if ($domain === '') return ['Mailboxes skipped: set MAIL_FROM (or MAIL_DOMAIN) in the config'];
  $log = [];

  if ((int)$pdo->query('SELECT COUNT(*) FROM mailboxes')->fetchColumn() === 0) {
    $personal = $pdo->prepare("INSERT INTO mailboxes (address, name, kind, owner_id) VALUES (?, ?, 'personal', ?)");
    foreach ($pdo->query("SELECT id, email, name FROM users ORDER BY role = 'admin' DESC, id")->fetchAll() as $u) {
      $email = strtolower((string)$u['email']);
      if (!str_ends_with($email, "@$domain")) continue;
      $personal->execute([$email, $u['name'] ?: ucfirst((string)strstr($email, '@', true)), (int)$u['id']]);
      $log[] = "Mailbox $email (personal)";
    }
    $shared = $pdo->prepare("INSERT IGNORE INTO mailboxes (address, name, kind, roles) VALUES (?, ?, 'shared', ?)");
    foreach ([
      ["info@$domain", 'Skyline Travel Solution', ['admin', 'manager', 'frontdesk']],
      ["applications@$domain", 'Skyline Applications', ['admin', 'manager', 'agent']],
    ] as [$address, $name, $roles]) {
      $shared->execute([$address, $name, json_encode($roles)]);
      if ($shared->rowCount()) $log[] = "Mailbox $address (shared: " . implode(', ', $roles) . ')';
    }
    /* the catch-all: the first administrator's own box, or else info@ */
    $catch = $pdo->query("SELECT m.id FROM mailboxes m JOIN users u ON u.id = m.owner_id WHERE m.kind = 'personal' AND u.role = 'admin' ORDER BY u.id LIMIT 1")->fetchColumn()
      ?: $pdo->query("SELECT id FROM mailboxes WHERE address = " . $pdo->quote("info@$domain"))->fetchColumn();
    if ($catch) {
      $pdo->prepare('UPDATE mailboxes SET catch_all = (id = ?)')->execute([(int)$catch]);
      $log[] = 'Catch-all: ' . $pdo->query('SELECT address FROM mailboxes WHERE id = ' . (int)$catch)->fetchColumn();
    }
    /* the website's box: the one the site already sends from, or else info@ */
    $site = $pdo->prepare('SELECT id FROM mailboxes WHERE address = ?');
    $site->execute([strtolower((string)($cfg['MAIL_FROM'] ?? ''))]);
    $siteId = $site->fetchColumn() ?: $pdo->query("SELECT id FROM mailboxes WHERE address = " . $pdo->quote("info@$domain"))->fetchColumn();
    if ($siteId) {
      $pdo->prepare('UPDATE mailboxes SET website = (id = ?)')->execute([(int)$siteId]);
      $log[] = 'Website mailbox: ' . $pdo->query('SELECT address FROM mailboxes WHERE id = ' . (int)$siteId)->fetchColumn();
    }
  }

  $rows = $pdo->query('SELECT id, direction, from_email, to_email FROM inbox_messages WHERE mailbox_id IS NULL')->fetchAll();
  if ($rows) {
    $find = $pdo->prepare('SELECT id FROM mailboxes WHERE address = ?');
    $catch = (int)$pdo->query('SELECT id FROM mailboxes ORDER BY catch_all DESC, id LIMIT 1')->fetchColumn();
    $set = $pdo->prepare('UPDATE inbox_messages SET mailbox_id = ? WHERE id = ?');
    foreach ($rows as $r) {
      $candidates = $r['direction'] === 'out' ? [(string)$r['from_email']] : preg_split('/\s*,\s*/', (string)$r['to_email']);
      $box = 0;
      foreach ($candidates as $a) {
        $find->execute([strtolower(trim($a))]);
        if ($box = (int)$find->fetchColumn()) break;
      }
      if ($box = $box ?: $catch) $set->execute([$box, (int)$r['id']]);
    }
    $log[] = 'Filed ' . count($rows) . ' earlier message(s) into mailboxes';
  }
  return $log;
}

