#!/usr/bin/env node
/**
 * Renders scripts/og.html to pfl/og.png at exactly 1200x630.
 *
 * Run it after editing scripts/og.html, or after changing which illustrations
 * appear on the card:
 *
 *   node scripts/og.mjs
 *
 * No dependencies. It launches whatever Chrome or Chromium it can find and
 * talks to it over the DevTools Protocol, because `chrome --screenshot` sizes
 * the capture from the window rather than the page and silently clips ~90px
 * off the bottom. Page.captureScreenshot takes an explicit clip and gets it
 * exactly right.
 *
 * Override the binary with CHROMIUM_PATH if it lives somewhere unusual.
 */

import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'scripts', 'og.html');
const target = join(root, 'pfl', 'og.png');

const WIDTH = 1200;
const HEIGHT = 630;
const PORT = 9222;

const CANDIDATES = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium',           // symlink straight to the binary
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const binary = CANDIDATES.find((p) => existsSync(p));
if (!binary) {
  console.error('No Chrome or Chromium found. Set CHROMIUM_PATH to the binary.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(binary, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'pfl-og-'))}`,
  `--window-size=${WIDTH},${HEIGHT}`,
  '--hide-scrollbars',
  '--no-sandbox',
  '--disable-gpu',
  '--force-device-scale-factor=1',
  '--allow-file-access-from-files',
  'about:blank',
], { stdio: 'ignore' });

/** The debug port is not up the instant the process is. Poll for it. */
async function endpoint() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      return (await res.json()).webSocketDebuggerUrl;
    } catch {
      await sleep(250);
    }
  }
  throw new Error('Chrome did not open its debugging port');
}

let id = 0;
function rpc(ws, method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const mine = ++id;
    const onMessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== mine) return;
      ws.removeEventListener('message', onMessage);
      if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
      else resolve(msg.result);
    };
    ws.addEventListener('message', onMessage);
    ws.send(JSON.stringify({ id: mine, method, params, sessionId }));
  });
}

try {
  const url = await endpoint();
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  const { targetId } = await rpc(ws, 'Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await rpc(ws, 'Target.attachToTarget', { targetId, flatten: true });

  await rpc(ws, 'Page.enable', {}, sessionId);
  await rpc(ws, 'Emulation.setDeviceMetricsOverride', {
    width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false,
  }, sessionId);

  const loaded = new Promise((resolve) => {
    const onEvent = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Page.loadEventFired' && msg.sessionId === sessionId) {
        ws.removeEventListener('message', onEvent);
        resolve();
      }
    };
    ws.addEventListener('message', onEvent);
  });

  await rpc(ws, 'Page.navigate', { url: pathToFileURL(source).href }, sessionId);
  await loaded;

  // Fonts and the PNGs both have to be decoded before the capture, or the card
  // renders in a fallback face with empty tiles.
  await rpc(ws, 'Runtime.evaluate', {
    expression: 'Promise.all([document.fonts.ready, ...[...document.images].map(i => i.decode().catch(() => {}))])',
    awaitPromise: true,
  }, sessionId);

  const { data } = await rpc(ws, 'Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 },
  }, sessionId);

  writeFileSync(target, Buffer.from(data, 'base64'));
  ws.close();
  console.log(`og.png         ${WIDTH}x${HEIGHT}`);
} finally {
  chrome.kill();
}
