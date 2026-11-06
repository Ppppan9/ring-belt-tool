/** Export jade/wood/candy C-gap rings via real theme().ring → static/ 352×333 */
import { open } from '../test/_page.mjs';
import fs from 'fs';
import path from 'path';

const OUT = path.resolve('/workspace/ring-belt/exports/cep_ring_mats/static');
const CMP = path.resolve('/workspace/ring-belt/exports/cep_ring_mats/compare');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(CMP, { recursive: true });

const CW = 352, CH = 333, CX = 176, CY = 157.59;
const R = 151; // match assets/named/ring_open_* centerline
const GAP_C = -Math.PI / 2; // gap up
const GAP_W = 58 * Math.PI / 180;
const COLORS = ['blue', 'cyan', 'green', 'orange', 'purple', 'red'];
const THEME_IDS = ['jade', 'wood', 'candy'];
const html = fs.existsSync('/workspace/ring-belt/jiehuan_chuansongdai_phase47.html')
  ? 'jiehuan_chuansongdai_phase47.html' : 'index.html';

const { b, p, errs } = await open('?det&seed=3', { width: 540, height: 900 }, html);
await p.waitForFunction(() => window.__ready && typeof window.__theme === 'function', null, { timeout: 60000 });

async function waitTheme(id) {
  await p.evaluate(async (tid) => {
    __setSettings({ theme: tid, showHint: false, handImage: '' });
    __setTheme(tid);
    // click card too so UI/assets path matches
    document.querySelector(`.theme-card[data-theme="${tid}"]`)?.click();
    if (window.themeAssetsReady) await themeAssetsReady();
  }, id);
  for (let i = 0; i < 400 && await p.evaluate(() => window.__themeBusy && __themeBusy()); i++) {
    await p.evaluate(() => __step(30));
  }
  await p.evaluate(() => __step(5));
}

function saveDataUrl(fp, dataUrl) {
  fs.writeFileSync(fp, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

for (const themeId of THEME_IDS) {
  await waitTheme(themeId);
  const ok = await p.evaluate(t => {
    const th = __theme();
    return { id: th?.id, hasRing: typeof th?.ring === 'function', name: th?.name, want: t };
  }, themeId);
  console.log('theme', ok);
  if (!ok.hasRing) throw new Error('no theme.ring for ' + themeId);

  for (const color of COLORS) {
    const png = await p.evaluate(({ CW, CH, CX, CY, R, GAP_C, GAP_W, color }) => {
      const BW = 640, BC = 320;
      const big = document.createElement('canvas');
      big.width = BW; big.height = BW;
      const bg = big.getContext('2d');
      const game = __game;
      const T = (__S().ringThick) || 30;
      const r = {
        id: 'cep_' + color, color, x: BC, y: BC, c: [BC, BC], R,
        gapC: GAP_C, gapW: GAP_W, closed: false, alive: true,
        rot: 0, children: [], hl: 0, omega: 0, anchor: false,
      };
      __theme().ring(bg, game, r, T);
      // measure visual extent (alpha>40) radially from center
      const d = bg.getImageData(0, 0, BW, BW).data;
      let maxR = 0, x0 = BW, x1 = 0, y0 = BW, y1 = 0;
      for (let y = 0; y < BW; y++) for (let x = 0; x < BW; x++) {
        if (d[(y * BW + x) * 4 + 3] > 40) {
          const rr = Math.hypot(x - BC, y - BC); if (y > BC && rr > maxR) maxR = rr; // bottom half: ignore gap caps
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      const TX = 175.5, TY = 157.8, M = 4;
      // align to default assets/ring_gap_*.png: outer R≈176 (bottom half), center (175.5,157.8)
      const s = 174.5 / maxR;
      const cnv = document.createElement('canvas');
      cnv.width = CW; cnv.height = CH;
      const g = cnv.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.setTransform(s, 0, 0, s, TX - BC * s, TY - BC * s);
      g.drawImage(big, 0, 0);
      console.log('scale', color, s.toFixed(4), 'maxR', maxR.toFixed(1));
      return cnv.toDataURL('image/png');
    }, { CW, CH, CX, CY, R, GAP_C, GAP_W, color });
    const fp = path.join(OUT, `${themeId}_ring_gap_${color}.png`);
    saveDataUrl(fp, png);
    console.log('wrote', path.basename(fp), fs.statSync(fp).size);
  }

  // balls (game-feel) — theme.ball
  for (const color of COLORS) {
    const png = await p.evaluate((color) => {
      const ball = __theme().ball?.(__game.color(color), 22);
      if (!ball) return null;
      const s = ball.dw || ball.width;
      const cnv = document.createElement('canvas');
      cnv.width = 96; cnv.height = 96;
      const g = cnv.getContext('2d');
      g.clearRect(0, 0, 96, 96);
      g.drawImage(ball, (96 - s) / 2, (96 - s) / 2, s, s);
      return cnv.toDataURL('image/png');
    }, color);
    if (png) {
      saveDataUrl(path.join(OUT, `${themeId}_ball_${color}.png`), png);
    }
  }

  // clips big/small if theme has images already exported — also bake from theme.clip onto transparent if possible
  // keep existing clip files; optional refresh via drawing a child ring clip is complex — skip unless easy
}

// comparison strips: red ring per theme + ref crop note
const strip = await p.evaluate(() => null);
console.log('errs', errs);
await b.close();

// make compare collage with python
console.log('done export, building compare…');
