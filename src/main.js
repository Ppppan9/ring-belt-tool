import { FONT_ROBOTO, FONT_LILITA } from './fonts.js';
const st = document.createElement('style'); st.textContent = `@font-face{font-family:RB;src:url(${FONT_ROBOTO}) format('woff')}@font-face{font-family:LI;src:url(${FONT_LILITA}) format('woff')}`; document.head.appendChild(st);
Promise.all([document.fonts.load('40px RB'), document.fonts.load('40px LI')]).catch(() => { }).finally(() => import('./app.js'));
