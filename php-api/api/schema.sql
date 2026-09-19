-- Skyline CMS schema. MySQL 5.7+ / 8.x, or MariaDB 10.2+ (cPanel).
-- Every statement is idempotent: run it again after an upgrade.

-- Staff accounts. admin = everything, including the team; editor = content, forms and mail.
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  name VARCHAR(120) NULL,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('admin','editor') NOT NULL DEFAULT 'editor',
  is_disabled TINYINT(1) NOT NULL DEFAULT 0,
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

-- The office mailbox: what arrived through Resend and what staff sent back.
CREATE TABLE IF NOT EXISTS inbox_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  resend_id VARCHAR(120) NULL,
  message_id VARCHAR(190) NULL,
  thread_key VARCHAR(40) NOT NULL,
  direction ENUM('in','out') NOT NULL DEFAULT 'in',
  from_email VARCHAR(190) NOT NULL,
  from_name VARCHAR(190) NULL,
  to_email VARCHAR(190) NULL,
  cc_email VARCHAR(190) NULL,
  subject VARCHAR(255) NOT NULL,
  text_body MEDIUMTEXT NULL,
  html_body MEDIUMTEXT NULL,
  attachments JSON NULL,
  in_reply_to VARCHAR(190) NULL,
  status ENUM('unread','read','archived','deleted') NOT NULL DEFAULT 'unread',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_message (message_id),
  INDEX idx_box (direction, status, created_at),
  INDEX idx_thread (thread_key, created_at)
);
