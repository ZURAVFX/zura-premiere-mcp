#!/usr/bin/env node

const origin = "https://oa-caption-studio-beta.vercel.app";
const page = await fetch(origin, { redirect: "follow", signal: AbortSignal.timeout(15000) });
if (!page.ok) throw new Error(`Caption Studio returned HTTP ${page.status}.`);

const html = await page.text();
const assets = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)["'][^>]*>/gi)]
  .map((match) => new URL(match[1], origin).href);
if (!assets.length) throw new Error("Caption Studio no longer publishes a readable JavaScript asset in its page.");

const names = new Set();
for (const asset of assets) {
  const response = await fetch(asset, { redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!response.ok) continue;
  const source = await response.text();
  // Read preset keys from the app's data object. The downloaded bundle is
  // treated as text only and is never evaluated.
  for (const match of source.matchAll(/([A-Za-z0-9_]{2,}):[A-Za-z_$][A-Za-z0-9_$]*\(\{width:\d+,height:\d+,fps:\d+,fontFamily:/g)) {
    names.add(match[1]);
  }
}

if (!names.size) {
  throw new Error("Caption Studio's preset catalogue format changed. Read the live preset selector; do not use a cached list.");
}

process.stdout.write(`${JSON.stringify({ source: origin, retrieved_at: new Date().toISOString(), presets: [...names].sort() }, null, 2)}\n`);
