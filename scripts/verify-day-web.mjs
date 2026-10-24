// SPDX-License-Identifier: MIT
// Isolated Day DOM rendering check. All non-fixture network access is denied.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(project,'Flix-Remote/build/day/cargo/web-dom/debug/dist');
const mime = { '.html':'text/html', '.js':'text/javascript', '.wasm':'application/wasm', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png' };
const server = createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (name === '/' ? '/index.html' : name));
    if (!file.startsWith(root + sep)) throw Error('path');
    const bytes = await readFile(file);
    res.writeHead(200, { 'Content-Type':mime[extname(file)] || 'application/octet-stream' }); res.end(bytes);
  } catch { res.writeHead(404); res.end('fixture only'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel:'msedge', headless:true });
const blocked = [], errors = [];
try {
  const context = await browser.newContext({ viewport:{width:390,height:844}, serviceWorkers:'block' });
  await context.route('**/*', route => {
    const u = new URL(route.request().url());
    return u.origin === origin ? route.continue() : (blocked.push(u.origin), route.abort());
  });
  await context.routeWebSocket('**/*', socket => { blocked.push('websocket'); socket.close(); });
  const page = await context.newPage();
  page.on('pageerror', err => errors.push(String(err)));
  await page.goto(origin);
  await expect(page.locator('#day-root iframe')).toBeVisible({timeout:30000});
  const host = page.frameLocator('#day-root iframe');
  await expect(host.locator('body')).toContainText('FLIX', {timeout:20000});
  // The shared page is a second frame owned by the existing remote UI.
  const remote = host.frameLocator('iframe');
  await expect(remote.locator('#tvPick')).toBeVisible({timeout:20000});
  await expect(remote.locator('#quickApps')).toBeAttached();
  await expect(remote.locator('body')).toContainText('تثبيت التطبيقات');
  await page.screenshot({path:resolve(project,'evidence/day-web-smoke.png'),fullPage:true});
  const result = {daySurface:true,originalRemote:true,deviceSelector:true,appsRow:true,installPanel:true,
    blockedOrigins:[...new Set(blocked)],pageErrors:errors,physicalDeviceTested:false,tvConnections:0};
  await writeFile(resolve(project,'evidence/day-web-smoke.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
} finally { await browser.close(); await new Promise(done => server.close(done)); }
