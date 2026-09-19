<?php
/*
 * LOCAL DEVELOPMENT ONLY — mounted by docker-compose.yml. Every value here is
 * a throwaway for the containers on this machine; production reads its own
 * ~/skyline-api-config.php (see php-api/config.example.php).
 */
return [
  'DB_HOST' => 'db',
  'DB_PORT' => 3306,
  'DB_NAME' => 'skyline',
  'DB_USER' => 'skyline',
  'DB_PASSWORD' => 'skyline-dev',

  'JWT_SECRET' => 'dev-only-secret-never-used-in-production-0123456789abcdef',
  'SITE_ORIGIN' => 'http://localhost:8080,http://localhost:5173',

  // no Resend locally: mail goes through SMTP to Mailpit (http://localhost:8025)
  'RESEND_API_KEY' => '',
  // base64 of "local-webhook-secret" — lets tests sign fake Resend events
  'RESEND_WEBHOOK_SECRET' => 'whsec_bG9jYWwtd2ViaG9vay1zZWNyZXQ=',
  'MAIL_FROM_NAME' => 'Skyline Travel Solution',
  'MAIL_FROM' => 'office@skyline-et.com',
  'NOTIFY_EMAIL' => 'office@skyline-et.com',
  'SMTP_HOST' => 'mail',
  'SMTP_PORT' => 1025,
  'SMTP_SECURE' => 'none',
  'SMTP_USER' => 'dev',
  'SMTP_PASS' => 'dev',

  'UPLOAD_DIR' => '/var/www/html/uploads',
  'PRIVATE_DIR' => '/var/www/private',

  'ADMIN_EMAIL' => 'admin@skyline.test',
  'ADMIN_PASSWORD' => 'skyline-admin-dev',
  'SETUP_TOKEN' => 'dev-setup-token',
];
