<?php
/*
 * Work boards — the office's client tracking, in the shape of the
 * spreadsheets it replaces: boards of typed columns, grouped rows (intakes,
 * stages), updates on each client and a full activity trail.
 *
 * Who sees what is decided here, on every request, never in the browser:
 *   - an agent sees only the clients assigned to them — asking for anyone
 *     else's answers "not found", so an agent cannot even learn who exists;
 *   - money columns are visible to admins and managers only;
 *   - clients' portal passwords are sealed (see seal() in lib.php) and only an
 *     admin, or the client's own agent, can reveal one. Every reveal is
 *     written to the activity log with who and when.
 *
 * Required from index.php, so $method and $path are already set.
 */

declare(strict_types=1);

const COLUMN_TYPES = [
  'text', 'longtext', 'email', 'phone', 'link', 'number', 'money', 'date',
  'checkbox', 'status', 'dropdown', 'person', 'secret',
];

/* the colours a status label may take — a fixed palette keeps boards legible */
const LABEL_COLORS = [
  '#c4c4c4', '#fdab3d', '#00c875', '#e2445c', '#579bfc', '#a25ddc',
  '#ff642e', '#037f4c', '#9d99b9', '#ffcb00', '#bb3354', '#175a63',
];

/* ---------- reading ---------- */

function board_row(int $id): array {
  $st = db()->prepare('SELECT * FROM boards WHERE id = ?');
  $st->execute([$id]);
  $b = $st->fetch();
  if (!$b) fail(404, 'Board not found');
  $b['id'] = (int)$b['id'];
  $b['settings'] = json_col($b['settings']) ?: [];
  return $b;
}

function board_columns(int $boardId): array {
  $st = db()->prepare('SELECT id, k, name, type, settings, sort, width FROM board_columns WHERE board_id = ? ORDER BY sort, id');
  $st->execute([$boardId]);
  $cols = [];
  foreach ($st as $c) {
    $cols[] = [
      'id' => (int)$c['id'],
      'k' => $c['k'],
      'name' => $c['name'],
      'type' => $c['type'],
      'settings' => json_col($c['settings']) ?: [],
      'sort' => (int)$c['sort'],
      'width' => $c['width'] !== null ? (int)$c['width'] : null,
    ];
  }
  return $cols;
}

function column_by_id(int $id): array {
  $st = db()->prepare('SELECT * FROM board_columns WHERE id = ?');
  $st->execute([$id]);
  $c = $st->fetch();
  if (!$c) fail(404, 'Column not found');
  $c['id'] = (int)$c['id'];
  $c['board_id'] = (int)$c['board_id'];
  $c['settings'] = json_col($c['settings']) ?: [];
  return $c;
}

/* A column's own list of roles wins; otherwise money is for admins and
   managers, and everything else is for anyone who can open the board. */
function column_roles(array $col): array {
  $roles = $col['settings']['roles'] ?? null;
  if (is_array($roles) && $roles) return array_values(array_intersect($roles, ROLES));
  if ($col['type'] === 'money') return CAPS['money'];
  return ROLES;
}

function column_visible(array $user, array $col): bool {
  return in_array($user['role'], column_roles($col), true);
}

function item_row(int $id): array {
  $st = db()->prepare('SELECT * FROM board_items WHERE id = ? AND archived = 0');
  $st->execute([$id]);
  $i = $st->fetch();
  if (!$i) fail(404, 'Not found');
  return $i;
}

function can_see_item(array $user, array $item): bool {
  if (can($user, 'boards_all')) return true;
  return (int)($item['assignee_id'] ?? 0) === $user['id'];
}

/* 404 rather than 403: an agent must not learn which other clients exist */
function require_item(array $user, int $id): array {
  $item = item_row($id);
  if (!can_see_item($user, $item)) fail(404, 'Not found');
  return $item;
}

function can_reveal(array $user, array $item): bool {
  if (can($user, 'secrets_all')) return true;
  return $user['role'] === 'agent' && (int)($item['assignee_id'] ?? 0) === $user['id'];
}

function can_edit_items(array $user): bool {
  return in_array($user['role'], ['admin', 'manager', 'frontdesk', 'agent'], true);
}

function can_manage_groups(array $user): bool {
  return in_array($user['role'], ['admin', 'manager'], true);
}

/* secret keys that hold a value, per item — the values themselves stay sealed */
function secret_keys_for(array $itemIds): array {
  if (!$itemIds) return [];
  $in = implode(',', array_map('intval', $itemIds));
  $out = [];
  foreach (db()->query("SELECT item_id, k FROM item_secrets WHERE item_id IN ($in)") as $r) {
    $out[(int)$r['item_id']][] = $r['k'];
  }
  return $out;
}

function present_item(array $user, array $item, array $cols, array $secretKeys): array {
  $vals = json_col($item['vals']) ?: [];
  $out = [];
  foreach ($cols as $c) {
    if (!column_visible($user, $c)) continue;
    if ($c['type'] === 'secret') {
      $out[$c['k']] = in_array($c['k'], $secretKeys, true); // only whether one is stored
    } elseif (array_key_exists($c['k'], $vals)) {
      $out[$c['k']] = $vals[$c['k']];
    }
  }
  return [
    'id' => (int)$item['id'],
    'group_id' => $item['group_id'] !== null ? (int)$item['group_id'] : null,
    'name' => $item['name'],
    'vals' => (object)$out,
    'assignee_id' => $item['assignee_id'] !== null ? (int)$item['assignee_id'] : null,
    'submission_id' => $item['submission_id'] !== null ? (int)$item['submission_id'] : null,
    'sort' => (int)$item['sort'],
    'created_at' => iso($item['created_at']),
    'updated_at' => iso($item['updated_at']),
    'can_reveal' => can_reveal($user, $item),
  ];
}

/* the people a person column can point at: active staff who use the boards */
function board_people(): array {
  $out = [];
  foreach (db()->query('SELECT id, name, email, role FROM users WHERE is_disabled = 0 ORDER BY COALESCE(name, email)') as $u) {
    if (!in_array($u['role'], CAPS['boards'], true)) continue;
    $out[] = ['id' => (int)$u['id'], 'name' => $u['name'] ?: $u['email'], 'role' => $u['role']];
  }
  return $out;
}

/* ---------- writing ---------- */

function log_activity(int $itemId, ?int $userId, string $action, array $detail = []): void {
  db()->prepare('INSERT INTO item_activity (item_id, user_id, action, detail) VALUES (?,?,?,?)')
    ->execute([$itemId, $userId, $action, $detail ? json_encode($detail, JSON_UNESCAPED_UNICODE) : null]);
}

/* A value as its column allows it, or null to clear it. Bad input is refused
   with the column's name in the message, so the person knows what to fix. */
function normalize_value(array $col, $v) {
  $name = $col['name'];
  $s = $col['settings'] ?? [];
  if ($v === null) return null;
  if (is_string($v) && trim($v) === '' && $col['type'] !== 'checkbox') return null;

  switch ($col['type']) {
    case 'text':
      return clean($v, 500);
    case 'longtext':
      return mb_substr(trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string)$v) ?? ''), 0, 5000);
    case 'email':
      $e = strtolower(clean($v, 190));
      if (!valid_email($e)) fail(400, "$name: that email address does not look right");
      return $e;
    case 'phone':
      return clean($v, 64);
    case 'link':
      $u = clean($v, 500);
      if (!preg_match('#^https?://#i', $u)) fail(400, "$name: a link must start with http:// or https://");
      return $u;
    case 'number':
    case 'money':
      $n = is_string($v) ? str_replace([',', ' '], '', $v) : $v;
      if (!is_numeric($n)) fail(400, "$name: that is not a number");
      return $n + 0;
    case 'date':
      $d = clean($v, 10);
      if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m) || !checkdate((int)$m[2], (int)$m[3], (int)$m[1])) {
        fail(400, "$name: dates are written YYYY-MM-DD");
      }
      return $d;
    case 'checkbox':
      return is_string($v) ? !in_array(strtolower(trim($v)), ['', '0', 'false', 'no', 'off'], true) : (bool)$v;
    case 'status':
      $label = clean($v, 60);
      $names = array_map(fn ($l) => (string)($l['name'] ?? ''), (array)($s['labels'] ?? []));
      if (!in_array($label, $names, true)) fail(400, "$name: \"$label\" is not one of its labels");
      return $label;
    case 'dropdown':
      $opt = clean($v, 120);
      if (!in_array($opt, array_map('strval', (array)($s['options'] ?? [])), true)) fail(400, "$name: \"$opt\" is not one of its options");
      return $opt;
    case 'person':
      if (is_array($v) && isset($v['name'])) {
        $legacy = clean($v['name'], 80); // a name from the old sheets, not yet matched to an account
        return $legacy === '' ? null : ['name' => $legacy];
      }
      $uid = (int)$v;
      $st = db()->prepare('SELECT role, is_disabled FROM users WHERE id = ?');
      $st->execute([$uid]);
      $u = $st->fetch();
      if (!$u || (int)$u['is_disabled'] === 1 || !in_array($u['role'], CAPS['boards'], true)) fail(400, "$name: that person cannot be assigned");
      return $uid;
    case 'secret':
      fail(400, "$name is a password field — set it with its own button");
  }
  fail(400, "$name: unknown column type");
}

/* The person column that decides who a client belongs to (and so which agent
   sees them). Recomputed from the item's values whenever they change. */
function assignee_from(array $board, array $vals): ?int {
  $k = (string)($board['settings']['assign_column'] ?? '');
  if ($k === '') return null;
  $v = $vals[$k] ?? null;
  return is_int($v) ? $v : (is_numeric($v) ? (int)$v : null);
}

/* Apply a patch of values to an item, column by column, recording each change.
   Columns the person may not see are refused, not silently ignored. */
function apply_values(array $user, array $board, array $cols, array $current, array $patch, int $itemId, bool $log): array {
  $byKey = [];
  foreach ($cols as $c) $byKey[$c['k']] = $c;
  $vals = $current;
  foreach ($patch as $k => $raw) {
    $col = $byKey[$k] ?? null;
    if (!$col) fail(400, "Unknown column \"$k\"");
    if (!column_visible($user, $col)) fail(403, "Your role cannot change {$col['name']}");
    $new = normalize_value($col, $raw);
    $old = $vals[$k] ?? null;
    if ($new === $old) continue;
    if ($new === null) unset($vals[$k]); else $vals[$k] = $new;
    if ($log) log_activity($itemId, $user['id'], 'set', ['k' => $k, 'from' => $old, 'to' => $new]);
  }
  return $vals;
}

function unique_column_key(int $boardId, string $name): string {
  $base = trim(preg_replace('/[^a-z0-9]+/', '_', strtolower($name)), '_') ?: 'column';
  $base = substr(preg_match('/^[a-z]/', $base) ? $base : "c_$base", 0, 36);
  $st = db()->prepare('SELECT k FROM board_columns WHERE board_id = ?');
  $st->execute([$boardId]);
  $taken = $st->fetchAll(PDO::FETCH_COLUMN);
  $k = $base;
  for ($n = 2; in_array($k, $taken, true); $n++) $k = "{$base}_$n";
  return $k;
}

/* status labels and dropdown options, cleaned to what the board can show */
function clean_column_settings(string $type, array $s, array $old = []): array {
  $out = $old;
  if ($type === 'status' && isset($s['labels'])) {
    $labels = [];
    foreach ((array)$s['labels'] as $l) {
      $name = clean($l['name'] ?? '', 60);
      if ($name === '' || in_array($name, array_column($labels, 'name'), true)) continue;
      $color = in_array($l['color'] ?? '', LABEL_COLORS, true) ? $l['color'] : LABEL_COLORS[count($labels) % count(LABEL_COLORS)];
      $labels[] = ['name' => $name, 'color' => $color, 'done' => !empty($l['done'])];
    }
    if (!$labels) fail(400, 'A status column needs at least one label');
    $out['labels'] = $labels;
  }
  if ($type === 'dropdown' && isset($s['options'])) {
    $opts = [];
    foreach ((array)$s['options'] as $o) {
      $o = clean($o, 120);
      if ($o !== '' && !in_array($o, $opts, true)) $opts[] = $o;
    }
    $out['options'] = $opts;
  }
  if ($type === 'money' && isset($s['currency'])) $out['currency'] = strtoupper(clean($s['currency'], 3)) ?: 'ETB';
  if (array_key_exists('roles', $s)) {
    $roles = array_values(array_intersect((array)$s['roles'], ROLES));
    if ($roles) $out['roles'] = $roles; else unset($out['roles']);
  }
  return $out;
}

/* ============================================================
   ROUTES
   ============================================================ */

/* ---------- boards ---------- */

if ($method === 'GET' && $path === '/admin/boards') {
  $u = require_cap('boards');
  $mine = can($u, 'boards_all') ? '' : ' AND i.assignee_id = ' . (int)$u['id'];
  $rows = [];
  foreach (db()->query("SELECT b.id, b.name, b.description, COUNT(i.id) AS n FROM boards b LEFT JOIN board_items i ON i.board_id = b.id AND i.archived = 0$mine GROUP BY b.id, b.name, b.description ORDER BY b.sort, b.id") as $r) {
    $rows[] = ['id' => (int)$r['id'], 'name' => $r['name'], 'description' => $r['description'], 'items' => (int)$r['n']];
  }
  send(200, $rows);
}

if ($method === 'POST' && $path === '/admin/boards') {
  require_cap('configure');
  $b = body_json();
  $name = clean($b['name'] ?? '', 120);
  if ($name === '') fail(400, 'Give the board a name');
  $pdo = db();
  $pdo->beginTransaction();
  $pdo->prepare('INSERT INTO boards (name, description, settings, sort) VALUES (?,?,?,?)')
    ->execute([$name, clean($b['description'] ?? '', 500) ?: null, json_encode(['assign_column' => 'agent', 'kanban_column' => 'status']),
      (int)$pdo->query('SELECT COALESCE(MAX(sort), 0) + 1 FROM boards')->fetchColumn()]);
  $id = (int)$pdo->lastInsertId();
  // a new board starts with the three columns every board here has needed
  $cols = [
    ['status', 'Status', 'status', ['labels' => [
      ['name' => 'New', 'color' => '#c4c4c4'], ['name' => 'Working on it', 'color' => '#fdab3d'],
      ['name' => 'Stuck', 'color' => '#e2445c'], ['name' => 'Done', 'color' => '#00c875', 'done' => true],
    ]]],
    ['agent', 'Agent', 'person', []],
    ['notes', 'Notes', 'longtext', []],
  ];
  $ins = $pdo->prepare('INSERT INTO board_columns (board_id, k, name, type, settings, sort) VALUES (?,?,?,?,?,?)');
  foreach ($cols as $n => [$k, $label, $type, $s]) $ins->execute([$id, $k, $label, $type, $s ? json_encode($s) : null, $n + 1]);
  $pdo->prepare('INSERT INTO board_groups (board_id, name, color, sort) VALUES (?,?,?,1)')->execute([$id, 'New', '#579bfc']);
  $pdo->commit();
  send(201, ['id' => $id]);
}

if (preg_match('#^/admin/boards/(\d+)$#', $path, $m)) {
  $boardId = (int)$m[1];

  if ($method === 'GET') {
    $u = require_cap('boards');
    $board = board_row($boardId);
    $cols = board_columns($boardId);
    $visible = array_values(array_filter($cols, fn ($c) => column_visible($u, $c)));

    $st = db()->prepare('SELECT id, name, color, sort FROM board_groups WHERE board_id = ? ORDER BY sort, id');
    $st->execute([$boardId]);
    $groups = array_map(fn ($g) => ['id' => (int)$g['id'], 'name' => $g['name'], 'color' => $g['color'], 'sort' => (int)$g['sort']], $st->fetchAll());

    $sql = 'SELECT * FROM board_items WHERE board_id = ? AND archived = 0' . (can($u, 'boards_all') ? '' : ' AND assignee_id = ?') . ' ORDER BY sort, id';
    $st = db()->prepare($sql);
    $st->execute(can($u, 'boards_all') ? [$boardId] : [$boardId, $u['id']]);
    $items = $st->fetchAll();
    $secrets = secret_keys_for(array_column($items, 'id'));
    $out = array_map(fn ($i) => present_item($u, $i, $cols, $secrets[(int)$i['id']] ?? []), $items);

    send(200, [
      'board' => ['id' => $board['id'], 'name' => $board['name'], 'description' => $board['description'], 'settings' => (object)$board['settings']],
      'columns' => $visible,
      'groups' => $groups,
      'items' => $out,
      'people' => board_people(),
      'me' => ['id' => $u['id'], 'role' => $u['role'], 'caps' => caps_of($u)],
      'label_colors' => LABEL_COLORS,
    ]);
  }

  if ($method === 'PUT') {
    require_cap('configure');
    $board = board_row($boardId);
    $b = body_json();
    $name = array_key_exists('name', $b) ? clean($b['name'], 120) : $board['name'];
    if ($name === '') fail(400, 'Give the board a name');
    $settings = $board['settings'];
    foreach (['assign_column', 'kanban_column'] as $k) {
      if (array_key_exists($k, (array)($b['settings'] ?? []))) $settings[$k] = clean($b['settings'][$k], 40);
    }
    db()->prepare('UPDATE boards SET name = ?, description = ?, settings = ? WHERE id = ?')
      ->execute([$name, array_key_exists('description', $b) ? (clean($b['description'], 500) ?: null) : $board['description'], json_encode($settings), $boardId]);
    send(200, ['ok' => true]);
  }

  if ($method === 'DELETE') {
    require_cap('configure');
    board_row($boardId);
    $st = db()->prepare('SELECT COUNT(*) FROM board_items WHERE board_id = ? AND archived = 0');
    $st->execute([$boardId]);
    if ((int)$st->fetchColumn() > 0) fail(409, 'Move or archive every item on this board before deleting it');
    $pdo = db();
    $pdo->beginTransaction();
    foreach (['DELETE FROM item_secrets WHERE item_id IN (SELECT id FROM board_items WHERE board_id = ?)',
              'DELETE FROM item_updates WHERE item_id IN (SELECT id FROM board_items WHERE board_id = ?)',
              'DELETE FROM item_activity WHERE item_id IN (SELECT id FROM board_items WHERE board_id = ?)',
              'DELETE FROM board_items WHERE board_id = ?', 'DELETE FROM board_columns WHERE board_id = ?',
              'DELETE FROM board_groups WHERE board_id = ?', 'DELETE FROM boards WHERE id = ?'] as $sql) {
      $pdo->prepare($sql)->execute([$boardId]);
    }
    $pdo->commit();
    send(200, ['ok' => true]);
  }
}

/* ---------- columns ---------- */

if ($method === 'POST' && preg_match('#^/admin/boards/(\d+)/columns$#', $path, $m)) {
  require_cap('configure');
  $boardId = (int)$m[1];
  board_row($boardId);
  $b = body_json();
  $name = clean($b['name'] ?? '', 80);
  $type = (string)($b['type'] ?? '');
  if ($name === '') fail(400, 'Give the column a name');
  if (!in_array($type, COLUMN_TYPES, true)) fail(400, 'Unknown column type');
  $settings = clean_column_settings($type, (array)($b['settings'] ?? []));
  if ($type === 'status' && empty($settings['labels'])) {
    $settings['labels'] = [['name' => 'New', 'color' => '#c4c4c4'], ['name' => 'Done', 'color' => '#00c875', 'done' => true]];
  }
  $k = unique_column_key($boardId, $name);
  $sort = db()->prepare('SELECT COALESCE(MAX(sort), 0) + 1 FROM board_columns WHERE board_id = ?');
  $sort->execute([$boardId]);
  db()->prepare('INSERT INTO board_columns (board_id, k, name, type, settings, sort) VALUES (?,?,?,?,?,?)')
    ->execute([$boardId, $k, $name, $type, $settings ? json_encode($settings, JSON_UNESCAPED_UNICODE) : null, (int)$sort->fetchColumn()]);
  send(201, ['id' => (int)db()->lastInsertId(), 'k' => $k]);
}

if ($method === 'POST' && preg_match('#^/admin/boards/(\d+)/columns/reorder$#', $path, $m)) {
  require_cap('configure');
  $boardId = (int)$m[1];
  $order = array_map('intval', (array)(body_json()['order'] ?? []));
  $st = db()->prepare('UPDATE board_columns SET sort = ? WHERE id = ? AND board_id = ?');
  foreach ($order as $n => $id) $st->execute([$n + 1, $id, $boardId]);
  send(200, ['ok' => true]);
}

if (preg_match('#^/admin/columns/(\d+)$#', $path, $m) && in_array($method, ['PUT', 'DELETE'], true)) {
  require_cap('configure');
  $col = column_by_id((int)$m[1]);

  if ($method === 'PUT') {
    $b = body_json();
    $name = array_key_exists('name', $b) ? clean($b['name'], 80) : $col['name'];
    if ($name === '') fail(400, 'Give the column a name');
    $settings = clean_column_settings($col['type'], (array)($b['settings'] ?? []), $col['settings']);
    $width = array_key_exists('width', $b) ? max(80, min(600, (int)$b['width'])) : null;
    db()->prepare('UPDATE board_columns SET name = ?, settings = ?' . ($width ? ', width = ' . $width : '') . ' WHERE id = ?')
      ->execute([$name, $settings ? json_encode($settings, JSON_UNESCAPED_UNICODE) : null, $col['id']]);
    send(200, ['ok' => true]);
  }

  // DELETE: the column goes; its values go with it, passwords included
  $pdo = db();
  $pdo->beginTransaction();
  if ($col['type'] === 'secret') {
    $pdo->prepare('DELETE FROM item_secrets WHERE k = ? AND item_id IN (SELECT id FROM board_items WHERE board_id = ?)')->execute([$col['k'], $col['board_id']]);
  }
  $st = $pdo->prepare('SELECT id, vals FROM board_items WHERE board_id = ?');
  $st->execute([$col['board_id']]);
  $upd = $pdo->prepare('UPDATE board_items SET vals = ? WHERE id = ?');
  foreach ($st->fetchAll() as $i) {
    $vals = json_col($i['vals']) ?: [];
    if (!array_key_exists($col['k'], $vals)) continue;
    unset($vals[$col['k']]);
    $upd->execute([$vals ? json_encode($vals, JSON_UNESCAPED_UNICODE) : null, $i['id']]);
  }
  $pdo->prepare('DELETE FROM board_columns WHERE id = ?')->execute([$col['id']]);
  $pdo->commit();
  send(200, ['ok' => true]);
}

/* ---------- groups ---------- */

if ($method === 'POST' && preg_match('#^/admin/boards/(\d+)/groups$#', $path, $m)) {
  $u = require_cap('boards');
  if (!can_manage_groups($u)) fail(403, 'Your role cannot add groups');
  $boardId = (int)$m[1];
  board_row($boardId);
  $b = body_json();
  $name = clean($b['name'] ?? '', 120);
  if ($name === '') fail(400, 'Give the group a name');
  $color = in_array($b['color'] ?? '', LABEL_COLORS, true) ? $b['color'] : '#579bfc';
  // new groups go on top: the newest intake is the one being worked on
  db()->prepare('UPDATE board_groups SET sort = sort + 1 WHERE board_id = ?')->execute([$boardId]);
  db()->prepare('INSERT INTO board_groups (board_id, name, color, sort) VALUES (?,?,?,1)')->execute([$boardId, $name, $color]);
  send(201, ['id' => (int)db()->lastInsertId()]);
}

if (preg_match('#^/admin/groups/(\d+)$#', $path, $m) && in_array($method, ['PUT', 'DELETE'], true)) {
  $u = require_cap('boards');
  if (!can_manage_groups($u)) fail(403, 'Your role cannot change groups');
  $st = db()->prepare('SELECT * FROM board_groups WHERE id = ?');
  $st->execute([(int)$m[1]]);
  $g = $st->fetch();
  if (!$g) fail(404, 'Group not found');

  if ($method === 'PUT') {
    $b = body_json();
    $name = array_key_exists('name', $b) ? clean($b['name'], 120) : $g['name'];
    if ($name === '') fail(400, 'Give the group a name');
    $color = in_array($b['color'] ?? '', LABEL_COLORS, true) ? $b['color'] : $g['color'];
    db()->prepare('UPDATE board_groups SET name = ?, color = ? WHERE id = ?')->execute([$name, $color, $g['id']]);
    send(200, ['ok' => true]);
  }

  $n = db()->prepare('SELECT COUNT(*) FROM board_items WHERE group_id = ? AND archived = 0');
  $n->execute([$g['id']]);
  if ((int)$n->fetchColumn() > 0) fail(409, 'Move the items out of this group before deleting it');
  db()->prepare('DELETE FROM board_groups WHERE id = ?')->execute([$g['id']]);
  send(200, ['ok' => true]);
}

/* ---------- items ---------- */

if ($method === 'POST' && preg_match('#^/admin/boards/(\d+)/items$#', $path, $m)) {
  $u = require_cap('boards');
  if (!can_edit_items($u)) fail(403, 'Your role cannot add clients');
  $boardId = (int)$m[1];
  $board = board_row($boardId);
  $cols = board_columns($boardId);
  $b = body_json();
  $name = clean($b['name'] ?? '', 190);
  if ($name === '') fail(400, 'Give the item a name');

  $groupId = isset($b['group_id']) ? (int)$b['group_id'] : null;
  if ($groupId) {
    $g = db()->prepare('SELECT id FROM board_groups WHERE id = ? AND board_id = ?');
    $g->execute([$groupId, $boardId]);
    if (!$g->fetchColumn()) fail(400, 'That group is not on this board');
  }

  $patch = (array)($b['vals'] ?? []);
  // an agent's new client is their own client, or they could not see it afterwards
  $assignKey = (string)($board['settings']['assign_column'] ?? '');
  if (!can($u, 'boards_all') && $assignKey !== '') $patch[$assignKey] = $u['id'];
  $vals = apply_values($u, $board, $cols, [], $patch, 0, false);

  $pdo = db();
  $pdo->prepare('UPDATE board_items SET sort = sort + 1 WHERE board_id = ? AND group_id <=> ?')->execute([$boardId, $groupId]);
  $pdo->prepare('INSERT INTO board_items (board_id, group_id, name, vals, assignee_id, sort, created_by) VALUES (?,?,?,?,?,1,?)')
    ->execute([$boardId, $groupId, $name, $vals ? json_encode($vals, JSON_UNESCAPED_UNICODE) : null, assignee_from($board, $vals), $u['id']]);
  $id = (int)$pdo->lastInsertId();
  log_activity($id, $u['id'], 'created', ['name' => $name]);
  $item = item_row($id);
  send(201, present_item($u, $item, $cols, []));
}

if (preg_match('#^/admin/board-items/(\d+)$#', $path, $m)) {
  $itemId = (int)$m[1];

  if ($method === 'GET') {
    $u = require_cap('boards');
    $item = require_item($u, $itemId);
    $board = board_row((int)$item['board_id']);
    $cols = board_columns($board['id']);
    $visible = [];
    foreach ($cols as $c) if (column_visible($u, $c)) $visible[$c['k']] = $c;

    $st = db()->prepare('SELECT u.id, u.body, u.created_at, u.user_id, s.name, s.email FROM item_updates u LEFT JOIN users s ON s.id = u.user_id WHERE u.item_id = ? ORDER BY u.created_at DESC, u.id DESC');
    $st->execute([$itemId]);
    $updates = array_map(fn ($r) => [
      'id' => (int)$r['id'], 'body' => $r['body'], 'created_at' => iso($r['created_at']),
      'user_id' => $r['user_id'] !== null ? (int)$r['user_id'] : null, 'by' => $r['name'] ?: ($r['email'] ?: 'Former staff'),
    ], $st->fetchAll());

    // the trail, less anything about a column this person cannot see
    $st = db()->prepare('SELECT a.action, a.detail, a.created_at, s.name, s.email FROM item_activity a LEFT JOIN users s ON s.id = a.user_id WHERE a.item_id = ? ORDER BY a.created_at DESC, a.id DESC LIMIT 200');
    $st->execute([$itemId]);
    $activity = [];
    foreach ($st as $r) {
      $d = json_col($r['detail']) ?: [];
      if (isset($d['k']) && !isset($visible[$d['k']])) continue;
      if (isset($d['k'])) $d['column'] = $visible[$d['k']]['name'];
      $activity[] = ['action' => $r['action'], 'detail' => (object)$d, 'created_at' => iso($r['created_at']), 'by' => $r['name'] ?: ($r['email'] ?: 'System')];
    }

    // the website application this client came from, with its documents
    $submission = null;
    if ($item['submission_id'] && can($u, 'messages')) {
      $s = db()->prepare('SELECT id, kind, created_at, extra FROM submissions WHERE id = ?');
      $s->execute([(int)$item['submission_id']]);
      if ($row = $s->fetch()) {
        $extra = json_col($row['extra']) ?: [];
        $submission = [
          'id' => (int)$row['id'], 'kind' => $row['kind'], 'created_at' => iso($row['created_at']),
          'documents' => array_map(fn ($d) => ['label' => $d['label'] ?? 'Document', 'filename' => $d['filename'], 'size' => $d['size'], 'type' => $d['type']], (array)($extra['documents'] ?? [])),
        ];
      }
    }

    send(200, [
      'item' => present_item($u, $item, $cols, secret_keys_for([$itemId])[$itemId] ?? []),
      'updates' => $updates,
      'activity' => $activity,
      'submission' => $submission,
    ]);
  }

  if ($method === 'PUT') {
    $u = require_cap('boards');
    if (!can_edit_items($u)) fail(403, 'Your role cannot change clients');
    $pdo = db();
    $pdo->beginTransaction();
    $st = $pdo->prepare('SELECT * FROM board_items WHERE id = ? AND archived = 0 FOR UPDATE');
    $st->execute([$itemId]);
    $item = $st->fetch();
    if (!$item || !can_see_item($u, $item)) { $pdo->rollBack(); fail(404, 'Not found'); }
    $board = board_row((int)$item['board_id']);
    $cols = board_columns($board['id']);
    $b = body_json();

    $name = $item['name'];
    if (array_key_exists('name', $b)) {
      $name = clean($b['name'], 190);
      if ($name === '') { $pdo->rollBack(); fail(400, 'Give the item a name'); }
      if ($name !== $item['name']) log_activity($itemId, $u['id'], 'renamed', ['from' => $item['name'], 'to' => $name]);
    }

    $groupId = $item['group_id'] !== null ? (int)$item['group_id'] : null;
    if (array_key_exists('group_id', $b) && (int)$b['group_id'] !== (int)$groupId) {
      $g = $pdo->prepare('SELECT id, name FROM board_groups WHERE id = ? AND board_id = ?');
      $g->execute([(int)$b['group_id'], $board['id']]);
      $grp = $g->fetch();
      if (!$grp) { $pdo->rollBack(); fail(400, 'That group is not on this board'); }
      $groupId = (int)$grp['id'];
      log_activity($itemId, $u['id'], 'moved', ['to' => $grp['name']]);
    }

    $vals = json_col($item['vals']) ?: [];
    if (isset($b['vals']) && is_array($b['vals'])) {
      $vals = apply_values($u, $board, $cols, $vals, $b['vals'], $itemId, true);
    }
    $assignee = assignee_from($board, $vals);
    // an agent who hands a client to someone else loses sight of them — that is the point
    $pdo->prepare('UPDATE board_items SET name = ?, group_id = ?, vals = ?, assignee_id = ? WHERE id = ?')
      ->execute([$name, $groupId, $vals ? json_encode($vals, JSON_UNESCAPED_UNICODE) : null, $assignee, $itemId]);
    $pdo->commit();

    $fresh = item_row($itemId);
    send(200, can_see_item($u, $fresh)
      ? present_item($u, $fresh, $cols, secret_keys_for([$itemId])[$itemId] ?? [])
      : ['id' => $itemId, 'gone' => true]);
  }

  if ($method === 'DELETE') {
    $u = require_cap('boards');
    if (!in_array($u['role'], ['admin', 'manager'], true)) fail(403, 'Only an administrator or a manager can archive a client');
    require_item($u, $itemId);
    db()->prepare('UPDATE board_items SET archived = 1 WHERE id = ?')->execute([$itemId]);
    log_activity($itemId, $u['id'], 'archived');
    send(200, ['ok' => true]);
  }
}

/* moving items around a board: order within a group, or into another group */
if ($method === 'POST' && preg_match('#^/admin/boards/(\d+)/items/reorder$#', $path, $m)) {
  $u = require_cap('boards');
  if (!can_edit_items($u)) fail(403, 'Your role cannot change clients');
  $boardId = (int)$m[1];
  $b = body_json();
  $groupId = isset($b['group_id']) ? (int)$b['group_id'] : null;
  $order = array_map('intval', (array)($b['order'] ?? []));
  $st = db()->prepare('UPDATE board_items SET sort = ?, group_id = ? WHERE id = ? AND board_id = ?' . (can($u, 'boards_all') ? '' : ' AND assignee_id = ' . (int)$u['id']));
  foreach ($order as $n => $id) $st->execute([$n + 1, $groupId, $id, $boardId]);
  send(200, ['ok' => true]);
}

/* ---------- updates (the conversation on a client) ---------- */

if ($method === 'POST' && preg_match('#^/admin/board-items/(\d+)/updates$#', $path, $m)) {
  $u = require_cap('boards');
  $itemId = (int)$m[1];
  require_item($u, $itemId);
  $body = mb_substr(trim((string)(body_json()['body'] ?? '')), 0, 10000);
  if ($body === '') fail(400, 'Write something first');
  db()->prepare('INSERT INTO item_updates (item_id, user_id, body) VALUES (?,?,?)')->execute([$itemId, $u['id'], $body]);
  db()->prepare('UPDATE board_items SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$itemId]);
  send(201, ['id' => (int)db()->lastInsertId()]);
}

if ($method === 'DELETE' && preg_match('#^/admin/updates/(\d+)$#', $path, $m)) {
  $u = require_cap('boards');
  $st = db()->prepare('SELECT * FROM item_updates WHERE id = ?');
  $st->execute([(int)$m[1]]);
  $up = $st->fetch();
  if (!$up) fail(404, 'Not found');
  require_item($u, (int)$up['item_id']);
  if ((int)$up['user_id'] !== $u['id'] && $u['role'] !== 'admin') fail(403, 'Only the author or an administrator can delete an update');
  db()->prepare('DELETE FROM item_updates WHERE id = ?')->execute([(int)$up['id']]);
  send(200, ['ok' => true]);
}

/* ---------- sealed passwords ---------- */

if (preg_match('#^/admin/board-items/(\d+)/secrets/([a-z][a-z0-9_]{0,39})(/reveal)?$#', $path, $m)) {
  $u = require_cap('boards');
  $itemId = (int)$m[1];
  $k = $m[2];
  $item = require_item($u, $itemId);
  $col = null;
  foreach (board_columns((int)$item['board_id']) as $c) if ($c['k'] === $k && $c['type'] === 'secret') $col = $c;
  if (!$col || !column_visible($u, $col)) fail(404, 'Not found');
  if (!can_reveal($u, $item)) fail(403, 'Only an administrator or this client\'s own agent can see or change their passwords');

  if ($method === 'POST' && !empty($m[3])) {
    rate_limit('reveal', 60, 30); // a burst of reveals is not someone reading one file
    $st = db()->prepare('SELECT sealed FROM item_secrets WHERE item_id = ? AND k = ?');
    $st->execute([$itemId, $k]);
    $sealed = $st->fetchColumn();
    if ($sealed === false) fail(404, 'No password is stored here');
    log_activity($itemId, $u['id'], 'secret_viewed', ['k' => $k]);
    send(200, ['value' => unseal((string)$sealed)], ['Cache-Control' => 'no-store']);
  }

  if ($method === 'PUT' && empty($m[3])) {
    $value = (string)(body_json()['value'] ?? '');
    if (mb_strlen($value) > 2000) fail(400, 'That is too long for a password field');
    if (trim($value) === '') {
      db()->prepare('DELETE FROM item_secrets WHERE item_id = ? AND k = ?')->execute([$itemId, $k]);
      log_activity($itemId, $u['id'], 'secret_cleared', ['k' => $k]);
    } else {
      db()->prepare('INSERT INTO item_secrets (item_id, k, sealed, updated_by) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE sealed = VALUES(sealed), updated_by = VALUES(updated_by)')
        ->execute([$itemId, $k, seal($value), $u['id']]);
      log_activity($itemId, $u['id'], 'secret_set', ['k' => $k]);
    }
    send(200, ['ok' => true]);
  }
  fail(405, 'Method not allowed');
}

/* ---------- names from the old sheets, matched to real accounts ---------- */

if ($method === 'POST' && preg_match('#^/admin/boards/(\d+)/map-person$#', $path, $m)) {
  $u = require_cap('configure');
  $boardId = (int)$m[1];
  $board = board_row($boardId);
  $b = body_json();
  $k = (string)($b['k'] ?? '');
  $legacy = clean($b['name'] ?? '', 80);
  $uid = (int)($b['user_id'] ?? 0);
  $col = null;
  foreach (board_columns($boardId) as $c) if ($c['k'] === $k && $c['type'] === 'person') $col = $c;
  if (!$col) fail(400, 'Unknown person column');
  normalize_value($col, $uid); // refuses anyone who cannot be assigned

  $st = db()->prepare('SELECT id, vals FROM board_items WHERE board_id = ?');
  $st->execute([$boardId]);
  $upd = db()->prepare('UPDATE board_items SET vals = ?, assignee_id = ? WHERE id = ?');
  $n = 0;
  foreach ($st->fetchAll() as $i) {
    $vals = json_col($i['vals']) ?: [];
    $v = $vals[$k] ?? null;
    if (!is_array($v) || strcasecmp((string)($v['name'] ?? ''), $legacy) !== 0) continue;
    $vals[$k] = $uid;
    $upd->execute([json_encode($vals, JSON_UNESCAPED_UNICODE), assignee_from($board, $vals), $i['id']]);
    log_activity((int)$i['id'], $u['id'], 'set', ['k' => $k, 'from' => $v, 'to' => $uid]);
    $n++;
  }
  send(200, ['updated' => $n]);
}

/* ---------- a website application becomes a client on a board ---------- */

if ($method === 'POST' && preg_match('#^/admin/boards/(\d+)/from-submission$#', $path, $m)) {
  $u = require_cap('boards');
  if (!can($u, 'messages')) fail(403, 'Your role cannot open website submissions');
  $boardId = (int)$m[1];
  $board = board_row($boardId);
  $cols = board_columns($boardId);
  $b = body_json();

  $st = db()->prepare('SELECT * FROM submissions WHERE id = ?');
  $st->execute([(int)($b['submission_id'] ?? 0)]);
  $s = $st->fetch();
  if (!$s) fail(404, 'Submission not found');
  $dupe = db()->prepare('SELECT id FROM board_items WHERE submission_id = ? AND board_id = ? AND archived = 0');
  $dupe->execute([(int)$s['id'], $boardId]);
  if ($existing = $dupe->fetchColumn()) send(200, ['id' => (int)$existing, 'existing' => true]);

  // copy across whatever the board has a column for, quietly skipping what does not fit
  $extra = json_col($s['extra']) ?: [];
  $source = ['phone' => $s['phone'], 'contact' => $s['phone'], 'email' => $s['email'],
    'destination' => $extra['destination'] ?? null, 'visa' => $extra['visa'] ?? null, 'type' => $extra['visa'] ?? null,
    'intake' => $extra['travel'] ?? ($extra['intake'] ?? null), 'notes' => $s['message']];
  /* Only shapes that cannot be refused are copied: normalize_value() answers a
     bad value by ending the request, and one odd field must not stop the rest. */
  $vals = [];
  foreach ($cols as $c) {
    $v = $source[$c['k']] ?? null;
    if ($v === null || $v === '' || !column_visible($u, $c)) continue;
    $v = (string)$v;
    switch ($c['type']) {
      case 'text': case 'phone':
        $vals[$c['k']] = clean($v, $c['type'] === 'phone' ? 64 : 500);
        break;
      case 'longtext':
        $vals[$c['k']] = mb_substr(trim($v), 0, 5000);
        break;
      case 'email':
        if (valid_email(strtolower(trim($v)))) $vals[$c['k']] = strtolower(trim($v));
        break;
      case 'status': case 'dropdown':
        $allowed = $c['type'] === 'status' ? array_column((array)($c['settings']['labels'] ?? []), 'name') : (array)($c['settings']['options'] ?? []);
        foreach ($allowed as $a) {
          if (strcasecmp((string)$a, $v) === 0 || stripos($v, (string)$a) === 0) { $vals[$c['k']] = (string)$a; break; }
        }
        break;
    }
  }
  $groupId = isset($b['group_id']) ? (int)$b['group_id'] : null;
  $assignKey = (string)($board['settings']['assign_column'] ?? '');
  if (!can($u, 'boards_all') && $assignKey !== '') $vals[$assignKey] = $u['id'];

  db()->prepare('INSERT INTO board_items (board_id, group_id, name, vals, assignee_id, submission_id, sort, created_by) VALUES (?,?,?,?,?,?,0,?)')
    ->execute([$boardId, $groupId, mb_substr((string)$s['name'], 0, 190), $vals ? json_encode($vals, JSON_UNESCAPED_UNICODE) : null,
      assignee_from($board, $vals), (int)$s['id'], $u['id']]);
  $id = (int)db()->lastInsertId();
  log_activity($id, $u['id'], 'created', ['from_submission' => (int)$s['id']]);
  db()->prepare('UPDATE submissions SET is_read = 1 WHERE id = ?')->execute([(int)$s['id']]);
  send(201, ['id' => $id]);
}

/* a document from the website application a client came from */
if ($method === 'GET' && preg_match('#^/admin/board-items/(\d+)/documents/(\d+)$#', $path, $m)) {
  $u = require_cap('boards');
  if (!can($u, 'messages') && $u['role'] !== 'agent') fail(403, 'Your role cannot open documents');
  $item = require_item($u, (int)$m[1]);
  if (!$item['submission_id']) fail(404, 'Document not found');
  $st = db()->prepare('SELECT extra FROM submissions WHERE id = ?');
  $st->execute([(int)$item['submission_id']]);
  $doc = ((json_col($st->fetchColumn() ?: '') ?: [])['documents'] ?? [])[(int)$m[2]] ?? null;
  $file = $doc ? document_dir() . '/' . basename((string)$doc['stored']) : '';
  if (!$doc || !is_file($file)) fail(404, 'Document not found');
  log_activity((int)$item['id'], $u['id'], 'document_opened', ['file' => $doc['filename']]);
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
