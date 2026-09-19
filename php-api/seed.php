<?php
/*
 * Command-line install / upgrade. On the server:
 *   php ~/skyline-api/seed.php ~/skyline-api-config.php
 * Same routine as POST /api/setup (see api/setup.php) — safe to run again.
 */

declare(strict_types=1);
require __DIR__ . '/api/lib.php';
require __DIR__ . '/api/setup.php';

$configPath = $argv[1] ?? (getenv('HOME') . '/skyline-api-config.php');
if (!is_file($configPath)) { fwrite(STDERR, "Config not found: $configPath\n"); exit(1); }
$cfg = require $configPath;

foreach (run_setup(connect_db($cfg), $cfg) as $line) echo $line, "\n";
echo "Setup complete.\n";
