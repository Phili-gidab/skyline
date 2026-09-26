<?php
/*
 * Loads the office's spreadsheets onto the work boards, once.
 *
 *   SKYLINE_CONFIG=~/skyline-api-config.php php import-boards.php spec.json
 *
 * The spec is produced by tools/sheets-to-boards.py from the downloaded
 * sheets. Passwords arrive in it as plain text and are sealed here, on the
 * server, with the key only the server holds — delete the spec afterwards.
 *
 * A board that already exists (by name) is skipped, never merged into, so a
 * second run cannot duplicate clients or overwrite anything edited since.
 */

declare(strict_types=1);
require __DIR__ . '/api/lib.php';

$specPath = $argv[1] ?? '';
if (!is_file($specPath)) { fwrite(STDERR, "Usage: php import-boards.php spec.json\n"); exit(1); }
$spec = json_decode((string)file_get_contents($specPath), true);
if (!is_array($spec)) { fwrite(STDERR, "The spec is not valid JSON\n"); exit(1); }

secrets_key(); // fail now, before anything is written, if the key is missing
$pdo = db();

foreach ($spec as $b) {
  $name = (string)$b['name'];
  $st = $pdo->prepare('SELECT id FROM boards WHERE name = ?');
  $st->execute([$name]);
  if ($st->fetchColumn()) { echo "Skipped \"$name\": a board with that name already exists\n"; continue; }

  $pdo->beginTransaction();
  $pdo->prepare('INSERT INTO boards (name, description, settings, sort) VALUES (?,?,?,?)')
    ->execute([$name, $b['description'] ?? null, json_encode($b['settings'] ?? new stdClass()),
      (int)$pdo->query('SELECT COALESCE(MAX(sort), 0) + 1 FROM boards')->fetchColumn()]);
  $boardId = (int)$pdo->lastInsertId();

  $col = $pdo->prepare('INSERT INTO board_columns (board_id, k, name, type, settings, sort) VALUES (?,?,?,?,?,?)');
  foreach (array_values($b['columns']) as $n => $c) {
    $col->execute([$boardId, $c['k'], $c['name'], $c['type'], !empty($c['settings']) ? json_encode($c['settings'], JSON_UNESCAPED_UNICODE) : null, $n + 1]);
  }

  $groups = [];
  $grp = $pdo->prepare('INSERT INTO board_groups (board_id, name, color, sort) VALUES (?,?,?,?)');
  foreach (array_values($b['groups']) as $n => $g) {
    $grp->execute([$boardId, $g['name'], $g['color'] ?? '#579bfc', $n + 1]);
    $groups[$g['name']] = (int)$pdo->lastInsertId();
  }

  $assignKey = (string)($b['settings']['assign_column'] ?? '');
  $item = $pdo->prepare('INSERT INTO board_items (board_id, group_id, name, vals, assignee_id, sort) VALUES (?,?,?,?,?,?)');
  $sec = $pdo->prepare('INSERT INTO item_secrets (item_id, k, sealed) VALUES (?,?,?)');
  $act = $pdo->prepare('INSERT INTO item_activity (item_id, user_id, action, detail) VALUES (?,NULL,?,?)');
  $counts = ['items' => 0, 'secrets' => 0];
  foreach (array_values($b['items']) as $n => $i) {
    $vals = $i['vals'] ?? [];
    $assignee = ($assignKey !== '' && is_int($vals[$assignKey] ?? null)) ? $vals[$assignKey] : null;
    $item->execute([$boardId, $groups[$i['group']] ?? null, mb_substr((string)$i['name'], 0, 190),
      $vals ? json_encode($vals, JSON_UNESCAPED_UNICODE) : null, $assignee, $n + 1]);
    $itemId = (int)$pdo->lastInsertId();
    $act->execute([$itemId, 'created', json_encode(['imported_from' => $b['source'] ?? 'spreadsheet'])]);
    foreach ($i['secrets'] ?? [] as $k => $plain) {
      if (trim((string)$plain) === '') continue;
      $sec->execute([$itemId, $k, seal((string)$plain)]);
      $counts['secrets']++;
    }
    $counts['items']++;
  }
  $pdo->commit();
  echo "Imported \"$name\": {$counts['items']} clients, {$counts['secrets']} passwords sealed, " . count($groups) . " groups\n";
}
