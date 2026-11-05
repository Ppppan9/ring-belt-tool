import { chromium } from 'playwright'; import fs from 'fs';
const b = await chromium.launch(); const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://127.0.0.1:8731/jiehuan_chuansongdai_phase13.html?det&seed=3&n=' + Date.now()); await p.waitForFunction(() => window.__ready);
const j = fs.readFileSync('/tmp/upjson', 'utf8');
console.log(await p.evaluate(async j => { __setSettings({ theme: 'jade', ...JSON.parse(j) }); const a = __beltAvg(); await new Promise(r => setTimeout(r, 500)); return [a, __beltAvg(), __S().beltFaceImage.length]; }, j)); await b.close();
