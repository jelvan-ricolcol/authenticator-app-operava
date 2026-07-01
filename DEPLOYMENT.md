# 🚀 Cloudflare Deployment Playbook: Operava Authenticator
### Hand-Coded and Published by **Jelvan Ricolcol, Developer**

This deployment workbook outlines the step-by-step instructions required to build, test, and lease **Operava Authenticator** on modern, low-latency, globally distributed cloud environments.

It is fully optimized to run on **Cloudflare serverless infrastructure**, mapping static client-side pages to **Cloudflare Pages**, API workers to **Cloudflare Workers**, and encrypted vaults securely to **Cloudflare D1 SQL Distributed Databases**.

---

## 🏗️ Deployment Lifecycle Architecture

The application is structured for frictionless transition from your local computer files directly to the Cloudflare Edge nodes. The production workflow operates as follows:

```
[ Developer Local Machine ] ---> [ GitHub Private Repo ] ---> [ GitHub Actions CI/CD Pipeline ]
                                                                       |
                                                                       v
                                                           [ Cloudflare Pages & D1 ]
```

---

## 💻 Part 1: Provisioning Cloudflare D1 SQL Database

Cloudflare D1 is an ultra-fast serverless relational database built on SQLite. Let's initialize a secure instance on your account.

### 1. Wrangler CLI Authentication
Wrangler is the official Cloudflare developer command-line interface. Run this in your terminal to log in:
```bash
npx wrangler login
```
*Action: A browser window will open automatically. Grant standard read/write permissions to establish your session token.*

### 2. D1 Database Creation
Create the database instance instantly:
```bash
npx wrangler d1 create operava_database
```

Wrangler outputs the details of your new database. Take note of the database metadata:
```text
✅ Successfully created database 'operava_database' on region 'global'

[[d1_databases]]
binding = "DB"
database_name = "operava_database"
database_id = "d1-353c058c-6e8d-4d36-b25e-f9ea5de53abe"
```

### 3. Binding to Wrangler Config
Open `/wrangler.toml` in your editor. Replace the placeholder database configuration with your newly generated id:
```toml
# /wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "operava_database"
database_id = "YOUR-GENERATED-DATABASE-ID-GOES-HERE"
migrations_dir = "./database"
```

### 4. Executing Migration Schemas
Migrate our security tables (`users`, `vault_entries`, `sessions`, `audit_logs`) to the live Cloudflare edge network using the schema file located in `/database/schema.sql`:
```bash
npx wrangler d1 execute operava_database --remote --file=./database/schema.sql
```

---

## ⚡ Part 2: Compiling & Publishing to Cloudflare Pages

To host the front-end SPA static assets and dynamic server endpoints, use Cloudflare Pages.

### 1. Build Compilation
Pre-test and convert your TypeScript, React 19, and Tailwind CSS code into an optimized web bundle:
```bash
npm run build
```
Verify that this compiles code flawlessly and places production assets into the `/dist` directory.

### 2. Cloudflare Project Deployment
Deploy the compiled directory to Cloudflare Pages:
```bash
npx wrangler pages deploy ./dist --project-name=operava-authenticator
```

When prompted, agree to create the project. Wrangler will construct your global servers and output a unique hosting address:
```text
✨ Success! Uploaded 18 files (100%)
🌍 Live URL: https://operava-authenticator.pages.dev
```

---

## 🧱 Part 3: Deploying Server Functions (Cloudflare Workers)

In order to proxy session logging, audits, login authorizations, and lock rate-limiting securely:

1. **Deploying Worker Triggers**:
   Wrangler uses the script defined in wrangler config to bundle and ship API edge routers. Execute:
   ```bash
   npx wrangler deploy
   ```
2. **Assigning Custom Vars (If Required)**:
   If configuring specific variables shown in `/wrangler.toml`, utilize the Cloudflare dashboard to define them or declare secrets in the CLI:
   ```bash
   npx wrangler secret put APPREG_TOKEN
   ```

---

## ⚙️ Part 4: Configuring Automatic CI/CD via GitHub Actions

This project includes a production-ready DevOps workflow script inside `.github/workflows/deploy.yml`. When you push updates to GitHub, the pipeline automatically lints, bundles, and publishes to your live Cloudflare instance.

To configure this pipeline, define the following variables under your GitHub Repository Settings:

### 1. Retrieve Secret Fields from Cloudflare

*   **`CLOUDFLARE_ACCOUNT_ID`**:
    1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com).
    2. Check your main account page. Your Account ID will display as a hexadecimal string in the sidebar or within the URL e.g., `8f7b2c9a...`.
*   **`CLOUDFLARE_API_TOKEN`**:
    1. Go to My Profile > **API Tokens**.
    2. Click **Create Token**.
    3. Use the page template **Edit Cloudflare Pages**, or configure a Custom Token with the permissions:
        *   `Account` > `Cloudflare Pages` > `Edit`
        *   `Account` > `D1` > `Edit`
    4. Generate and save the secure API Key.

### 2. Enter GitHub Secrets
1. Go to your GitHub project repository, click **Settings** (top navigation).
2. Expand **Secrets and Variables** in the left navigation panel > Click **Actions**.
3. Create two **Repository Secrets**:
   *   Name: `CLOUDFLARE_ACCOUNT_ID` | Secret: `[Paste your Cloudflare Account ID]`
   *   Name: `CLOUDFLARE_API_TOKEN` | Secret: `[Paste your Cloudflare API Token]`

Save both keys. Now, every single commit pushed to the `main` branch will automatically update your globally hosted authenticator live!

---

## 🔒 Security & Client Production Pledge
No decryptor hashes, master secrets, or TOTP keys ever traverse the network plaintext. Decryption pipelines remain fully sealed within the web browser.

This platform represents a secure showcase and PORTFOLIO application developed and managed by **Jelvan Ricolcol, Developer**. Released with absolute privacy mechanisms and complete client applicability under the permissive **MIT License**.
