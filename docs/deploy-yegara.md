# Deploying to Yegara (cPanel) — skyline-et.com

The site is static files plus a small PHP API, all on the one cPanel host:

```
/home/USER/
├── skyline-api-config.php     ← secrets. OUTSIDE the web root. Never in git.
├── skyline-private/           ← CVs, mail attachments, rate-limit files (PRIVATE_DIR)
└── public_html/
    ├── .htaccess              ← from dist/ (routes /api and /admin — do not skip it)
    ├── index.html, assets/, flyover/, models/, …   ← everything in dist/
    ├── api/                   ← php-api/api/*  (index.php, lib.php, setup.php, schema.sql, seed-data.json)
    └── uploads/               ← photos and PDFs uploaded in the admin
        └── .htaccess          ← php-api/uploads.htaccess, renamed
```

Nothing is compiled on the server. You build on your computer and upload.

---

## 1. One-time setup

### 1.1 Database

cPanel → **MySQL Databases**:

1. Create a database, e.g. `skyline` (cPanel names it `USER_skyline`).
2. Create a user with a long generated password.
3. **Add User To Database** → tick **ALL PRIVILEGES**.

### 1.2 PHP

- cPanel → **MultiPHP Manager**: set skyline-et.com to **PHP 8.1 or newer** (8.3 if offered).
- cPanel → **Select PHP Version → Extensions** (the name varies by host): make sure `pdo_mysql`, `curl`, `fileinfo`
  and `gd` are ticked.
- cPanel → **MultiPHP INI Editor**: `upload_max_filesize = 12M`, `post_max_size = 14M`. (CVs are capped at 5 MB and
  admin uploads at 10 MB; the defaults on many hosts are 2 MB.)

### 1.3 The config file

1. Copy `php-api/config.example.php` to your computer's desktop, rename it `skyline-api-config.php` and fill it in:
   - the database name, user and password from 1.1;
   - `JWT_SECRET`: 64 random characters (a password manager's generator is fine);
   - `UPLOAD_DIR`: `/home/USER/public_html/uploads`;
   - `PRIVATE_DIR`: `/home/USER/skyline-private`;
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD`: the first administrator (password 10+ characters);
   - `SETUP_TOKEN`: any long random string, for step 1.5;
   - email settings: see section 2 (they can be added later).
   Your home path (`/home/USER`) is shown on the right of the cPanel home page.
2. cPanel → **File Manager** → your **home** folder (the one *above* `public_html`) → Upload it there.
3. In File Manager, create the folder `skyline-private` next to it.

### 1.4 Upload the site

On your computer:

```bash
npm install
npm run build
```

Then in File Manager:

1. Upload **the contents** of `dist/` into `public_html/`. It includes a hidden `.htaccess` — in File Manager turn on
   *Settings → Show Hidden Files* and check it arrived. Without it, `/admin` and the API return 404.
2. Create `public_html/api/` and upload the files from `php-api/api/` into it.
3. Create `public_html/uploads/`, upload `php-api/uploads.htaccess` into it and rename it to `.htaccess`.

Check: `https://skyline-et.com/api/health` shows `{"ok":true,…}`. If it says *API not configured*, the config file is
not where step 1.3 put it.

### 1.5 Install the database

This creates the tables, the first administrator, and loads the site's current content so there is something to edit.
It is safe to run again: it never overwrites edits.

**With cPanel Terminal or SSH** (if your plan has it), upload `php-api/seed.php` and the `api/` folder to
`~/skyline-api/`, then:

```bash
php ~/skyline-api/seed.php ~/skyline-api-config.php
```

**Without a terminal**, open `https://skyline-et.com` in Chrome, press F12 → *Console*, and paste (with your token):

```js
fetch('/api/setup', { method: 'POST', headers: { 'X-Setup-Token': 'YOUR-SETUP-TOKEN' } })
  .then((r) => r.json()).then(console.log)
```

It prints what it did. **Then edit the config file: empty `SETUP_TOKEN` and `ADMIN_PASSWORD`.**

### 1.6 Sign in

`https://skyline-et.com/admin` — the email and password from the config. Change the password under *My account*, then
invite the rest of the team under *Team* (they get a link to choose their own password).

---

## 2. Email

The API sends in this order, stopping at the first that works: **Resend → the office mailbox (SMTP) → PHP mail()**.
Every attempt is logged under *Email log* in the admin, with a *Send test* button.

### 2.1 A mailbox for the office (do this first)

cPanel → **Email Accounts** → create e.g. `office@skyline-et.com`. That is the address on the site, the one form
notices go to (`NOTIFY_EMAIL`), and the fallback sender:

```php
'NOTIFY_EMAIL' => 'office@skyline-et.com',
'MAIL_FROM' => 'office@skyline-et.com',
'SMTP_HOST' => 'mail.skyline-et.com',
'SMTP_PORT' => 465,
'SMTP_SECURE' => 'ssl',
'SMTP_USER' => 'office@skyline-et.com',
'SMTP_PASS' => '…the mailbox password…',
```

With just this, forms already email the office and confirm to visitors.

### 2.2 Resend, for sending (recommended)

Mail from shared hosting often lands in spam; Resend signs it properly and reports delivery back.

1. Create an account at resend.com → **Domains → Add domain** → `skyline-et.com`.
2. Resend shows DNS records (DKIM and SPF). Add each one exactly as shown in cPanel → **Zone Editor** →
   skyline-et.com → **Manage**. Wait for Resend to show *Verified*.
3. **API Keys → Create** → put it in the config as `RESEND_API_KEY`.
4. Admin → *Email log* → **Send test**. It should say *via resend*.

### 2.3 Resend, for receiving — the admin Mailbox

The admin's Mailbox shows mail that Resend receives for you and passes to the site. Receiving needs MX records that
point at Resend, and a domain can only have one set of MX records. So receive on a **subdomain** and keep the cPanel
mailbox for the main address:

1. Resend → **Domains → Add domain** → e.g. `mail.skyline-et.com` → enable **Receiving** and add the records it shows
   (MX and any TXT) in the Zone Editor.
2. cPanel → **Forwarders** → forward `office@skyline-et.com` to `office@mail.skyline-et.com`. The office keeps its
   normal mailbox, and a copy of every message lands in the admin.
3. Resend → **Webhooks → Add endpoint**: `https://skyline-et.com/api/resend/webhook`, with the events
   `email.received`, `email.delivered`, `email.bounced`, `email.complained`, `email.delivery_delayed` and `email.opened`.
4. Copy the webhook's **signing secret** (`whsec_…`) into the config as `RESEND_WEBHOOK_SECRET`.

Until that secret is set the webhook refuses everything — deliberately: without it anyone could post messages into
the office inbox. Replies sent from the admin go out from `MAIL_FROM` and thread in the recipient's mail client.

(Alternatively, point skyline-et.com's own MX at Resend and let the admin Mailbox *be* the office inbox. Then the
cPanel mailbox stops receiving, so only do it deliberately.)

---

## 3. Updating the site later

- **Content** is edited in the admin — no upload needed. Changes show on the next page load.
- **Design or code changes:** `npm run build`, then upload the new `dist/` over `public_html/`. Leave `api/` and
  `uploads/` alone. Old files in `assets/` can be deleted afterwards; the new `index.html` no longer references them.
- **API changes:** upload the changed files into `public_html/api/`. If `schema.sql` changed, run the install again
  (1.5) — it only adds what is missing.
- **New defaults** in `src/data/site.js`: run `npm run seed:export` before uploading `api/`. Setup loads a list only
  while it is empty, so it never replaces what the office has edited.

## 4. Backups

cPanel → **Backup**: download the **MySQL database** and a **home directory** backup (that includes `uploads/` and
`skyline-private/` with the CVs). Monthly is sensible; before any big change, always.

## 5. When something is wrong

| Symptom | Likely cause |
| --- | --- |
| `/admin` or `/api/…` gives a 404 page | `public_html/.htaccess` missing — it is hidden; re-upload it |
| Signed in, but every page says *Session expired* | The host strips the `Authorization` header: check the `.htaccess` is the one from `dist/` |
| `{"error":"API not configured"}` | Config file not at `/home/USER/skyline-api-config.php` |
| Uploads or CVs fail | PHP upload limits (1.2), or `uploads/` / `skyline-private/` missing or not writable |
| 406 or 403 on saving | The host's ModSecurity firewall — ask Yegara support to allow requests to `/api/` |
| Forms send, but nobody is emailed | *Email log* shows why; *Send test* checks the route |
| Mailbox stays empty | Webhook not set up, or `RESEND_WEBHOOK_SECRET` missing (2.3) |

## 6. Local development

Docker runs the same stack on your computer (PHP 8.3 + Apache, MySQL 8, and Mailpit to catch email):

```bash
npm run build          # the container serves dist/, like public_html
npm run api:up         # start PHP, MySQL, Mailpit
npm run api:setup      # tables, test admin, content
npm run dev            # live-reloading site on :5173, /api proxied to the container
```

- Site and admin as in production: http://localhost:8080 and http://localhost:8080/admin
  (`admin@skyline.test` / `skyline-admin-dev` — local only, from `docker/config.dev.php`)
- Every email the API sends: http://localhost:8025
- `npm run api:down` stops it; add `-v` to the underlying command to wipe the local database.
