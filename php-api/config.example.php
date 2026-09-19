<?php
/*
 * Skyline API configuration.
 *
 * COPY THIS OUTSIDE THE WEB ROOT as ~/skyline-api-config.php — one level
 * above public_html — and fill it in there. Never commit the real file.
 * See docs/deploy-yegara.md.
 */
return [
  // cPanel → MySQL Databases (cPanel prefixes the names with your account name)
  'DB_HOST' => 'localhost',
  'DB_PORT' => 3306,
  'DB_NAME' => 'cpaneluser_skyline',
  'DB_USER' => 'cpaneluser_skyline',
  'DB_PASSWORD' => 'change-me',

  // a long random string (64+ characters) — signs admin sign-ins
  'JWT_SECRET' => 'change-me',

  // where the site lives: the first origin is used in email links
  'SITE_ORIGIN' => 'https://skyline-et.com,https://www.skyline-et.com',

  // Resend — the preferred sender (verify skyline-et.com in the Resend dashboard first)
  'RESEND_API_KEY' => '',         // re_...
  'RESEND_WEBHOOK_SECRET' => '',  // whsec_... — the admin inbox stays off until this is set
  'MAIL_FROM_NAME' => 'Skyline Travel Solution',
  'MAIL_FROM' => 'office@skyline-et.com',

  // where form notices go (empty = no notices)
  'NOTIFY_EMAIL' => 'office@skyline-et.com',

  // Fallback sender: the office's own cPanel mailbox (cPanel → Email Accounts).
  // Leave SMTP_HOST empty to fall back to PHP's mail() instead.
  'SMTP_HOST' => 'mail.skyline-et.com',
  'SMTP_PORT' => 465,
  'SMTP_SECURE' => 'ssl',         // 'ssl' for 465, 'tls' for 587
  'SMTP_USER' => 'office@skyline-et.com',
  'SMTP_PASS' => '',

  // absolute path to public_html/uploads — photos and PDFs uploaded in the admin
  'UPLOAD_DIR' => '/home/cpaneluser/public_html/uploads',

  // absolute path OUTSIDE public_html — CVs, mail attachments, rate-limit files
  'PRIVATE_DIR' => '/home/cpaneluser/skyline-private',

  // the first admin, created by setup (password: 10+ characters). You can
  // blank ADMIN_PASSWORD after the first run; it is never used to sign in.
  'ADMIN_EMAIL' => 'you@example.com',
  'ADMIN_PASSWORD' => 'change-me-too',

  // set to a long random string ONLY while running the browser setup
  // (POST /api/setup), then empty it again
  'SETUP_TOKEN' => '',
];
