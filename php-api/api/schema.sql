-- Skyline CMS schema. MySQL 5.7+ / 8.x, or MariaDB 10.2+ (cPanel).
-- Every statement is idempotent: run it again after an upgrade.

-- Staff accounts. `email` is the sign-in address — their own at the office's
-- domain, which is also their mailbox; `recovery_email` is a private one for
-- password links. Roles and what each may do: CAPS in lib.php.
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  recovery_email VARCHAR(190) NULL,
  name VARCHAR(120) NULL,
  signature TEXT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'editor',
  is_disabled TINYINT(1) NOT NULL DEFAULT 0,
  token_version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL
);

-- One-time links to set a password (a forgotten one, or a new colleague's first).
-- Only the SHA-256 of the token is stored.
CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id)
);

-- Singleton sections (brand, hero, scholarship, notice) — one JSON document per key.
CREATE TABLE IF NOT EXISTS content (
  k VARCHAR(64) PRIMARY KEY,
  data JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(190) NULL
);

-- Every list on the site (destinations, service lines, roles, ...) in one table:
-- a new section needs no migration.
CREATE TABLE IF NOT EXISTS items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  collection VARCHAR(64) NOT NULL,
  data JSON NOT NULL,
  sort INT NOT NULL DEFAULT 0,
  published TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_collection (collection, published, sort)
);

-- The website forms: visa enquiries, study applications, job applications.
CREATE TABLE IF NOT EXISTS submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kind VARCHAR(24) NOT NULL,
  name VARCHAR(190) NOT NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(64) NULL,
  message TEXT NULL,
  extra JSON NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_kind (kind, is_read, created_at)
);

-- What the site sent, and what the provider said happened to it.
CREATE TABLE IF NOT EXISTS email_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  to_email VARCHAR(190) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  provider VARCHAR(16) NOT NULL DEFAULT 'resend',
  provider_id VARCHAR(120) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'sent',
  error VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_created (created_at),
  INDEX idx_provider_id (provider_id)
);

-- Every mailbox's mail: what arrived through Resend, form notices filed
-- in-house, and what staff sent. One row per mailbox a message is in.
CREATE TABLE IF NOT EXISTS inbox_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mailbox_id INT NULL,
  resend_id VARCHAR(120) NULL,
  message_id VARCHAR(190) NULL,
  thread_key VARCHAR(40) NOT NULL,
  direction ENUM('in','out') NOT NULL DEFAULT 'in',
  from_email VARCHAR(190) NOT NULL,
  from_name VARCHAR(190) NULL,
  to_email VARCHAR(500) NULL,
  cc_email VARCHAR(500) NULL,
  reply_to VARCHAR(190) NULL,
  subject VARCHAR(255) NOT NULL,
  text_body MEDIUMTEXT NULL,
  html_body MEDIUMTEXT NULL,
  attachments JSON NULL,
  in_reply_to VARCHAR(190) NULL,
  auth VARCHAR(80) NULL,
  source VARCHAR(20) NULL,
  submission_id INT NULL,
  delivery VARCHAR(20) NULL,
  sent_by INT NULL,
  status ENUM('unread','read','archived','deleted','spam') NOT NULL DEFAULT 'unread',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_box_resend (mailbox_id, resend_id),
  INDEX idx_mailbox (mailbox_id, direction, status, created_at),
  INDEX idx_thread (thread_key, created_at),
  INDEX idx_message (message_id),
  INDEX idx_resend (resend_id)
);

-- ------------------------------------------------------------------
-- The five roles outgrew the original ENUM; widen it on existing installs.
ALTER TABLE users MODIFY role VARCHAR(20) NOT NULL DEFAULT 'editor';

-- ------------------------------------------------------------------
-- Work boards: the office's client tracking, in place of the spreadsheets.
-- A board has typed columns, groups (intakes, stages) and items (clients).
CREATE TABLE IF NOT EXISTS boards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NULL,
  settings JSON NULL,
  sort INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS board_columns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  board_id INT NOT NULL,
  k VARCHAR(40) NOT NULL,
  name VARCHAR(80) NOT NULL,
  type VARCHAR(20) NOT NULL,
  settings JSON NULL,
  sort INT NOT NULL DEFAULT 0,
  width INT NULL,
  UNIQUE KEY uq_board_col (board_id, k),
  INDEX idx_board (board_id, sort)
);

CREATE TABLE IF NOT EXISTS board_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  board_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  color VARCHAR(20) NULL,
  sort INT NOT NULL DEFAULT 0,
  INDEX idx_board (board_id, sort)
);

CREATE TABLE IF NOT EXISTS board_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  board_id INT NOT NULL,
  group_id INT NULL,
  name VARCHAR(190) NOT NULL,
  vals JSON NULL,
  assignee_id INT NULL,
  submission_id INT NULL,
  sort INT NOT NULL DEFAULT 0,
  archived TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_board (board_id, archived, group_id, sort),
  INDEX idx_assignee (assignee_id)
);

-- clients' portal passwords, sealed (AES-256-GCM) — never stored in vals
CREATE TABLE IF NOT EXISTS item_secrets (
  item_id INT NOT NULL,
  k VARCHAR(40) NOT NULL,
  sealed TEXT NOT NULL,
  updated_by INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id, k)
);

CREATE TABLE IF NOT EXISTS item_updates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  user_id INT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_item (item_id, created_at)
);

-- every change, and every time a password is revealed
CREATE TABLE IF NOT EXISTS item_activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  user_id INT NULL,
  action VARCHAR(40) NOT NULL,
  detail JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_item (item_id, created_at)
);

-- ------------------------------------------------------------------
-- Mailboxes: every address at the office's domain that someone reads. A
-- personal box is one person's (their sign-in address); a shared one
-- (info@, applications@) is read by the roles it lists and by anyone named
-- in mailbox_members. Mail for an address with no box goes to the catch-all;
-- the `website` box sends the forms' confirmations and files their notices.
CREATE TABLE IF NOT EXISTS mailboxes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  address VARCHAR(190) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  kind ENUM('personal','shared') NOT NULL DEFAULT 'shared',
  owner_id INT NULL,
  roles JSON NULL,
  catch_all TINYINT(1) NOT NULL DEFAULT 0,
  website TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_owner (owner_id)
);

CREATE TABLE IF NOT EXISTS mailbox_members (
  mailbox_id INT NOT NULL,
  user_id INT NOT NULL,
  PRIMARY KEY (mailbox_id, user_id),
  INDEX idx_user (user_id)
);

-- Existing installs: room for several recipients, and a spam folder.
-- (New columns and indexes are added by setup.php, which checks first.)
ALTER TABLE inbox_messages MODIFY to_email VARCHAR(500) NULL;
ALTER TABLE inbox_messages MODIFY cc_email VARCHAR(500) NULL;
ALTER TABLE inbox_messages MODIFY status ENUM('unread','read','archived','deleted','spam') NOT NULL DEFAULT 'unread';
ALTER TABLE email_log MODIFY to_email VARCHAR(500) NOT NULL;
