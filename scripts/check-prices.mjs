// Comprueba que los precios de la app (src/data/testCatalog.ts) coinciden con los
// que cobra el servidor (supabase/functions/_shared/products.ts). Uso: npm run check:prices
import { readFileSync } from 'node:fs';

const app = readFileSync('src/data/testCatalog.ts', 'utf8');
const server = readFileSync('supabase/functions/_shared/products.ts', 'utf8');

const appPrices = new Map();
for (const m of app.matchAll(/id: '([a-z0-9_]+)',\s*category: '[a-z]+',\s*name: '[^']+',\s*price: ([0-9.]+)/g)) {
  appPrices.set(m[1], Math.round(Number(m[2]) * 100));
}
const serverPrices = new Map();
for (const m of server.matchAll(/^  ([a-z0-9_]+): \{ name: '[^']*', amountCents: (\d+)/gm)) {
  serverPrices.set(m[1], Number(m[2]));
}

const problems = [];
for (const [id, cents] of appPrices) {
  if (!serverPrices.has(id)) problems.push(`${id}: missing on the server`);
  else if (serverPrices.get(id) !== cents) problems.push(`${id}: app ${cents} vs server ${serverPrices.get(id)} cents`);
}
for (const id of serverPrices.keys()) if (!appPrices.has(id)) problems.push(`${id}: only on the server`);

if (problems.length) {
  console.error('Price mismatch:\n' + problems.join('\n'));
  process.exit(1);
}
console.log(`OK: ${appPrices.size} products, app and server prices match.`);
