// 控制面板视觉/动效层（GSAP，离线打包）。只做“装饰 + 动画”，不改 id / key / 顺序 / 结构语义。
import { gsap } from 'gsap';
const RM = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const D = s => RM() ? 0 : s;
const P = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = { // 线性图标（24×24）
  '主题': '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.3"/><circle cx="12" cy="7.5" r="1.3"/><circle cx="15.5" cy="10" r="1.3"/><path d="M12 21a3 3 0 0 1 0-6h2"/>',
  '关卡': '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  '音效': '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  '手指': '<path d="M9 11V5a2 2 0 0 1 4 0v6M13 10a2 2 0 0 1 4 0v3a7 7 0 0 1-7 7 6 6 0 0 1-5-3l-2-4a1.8 1.8 0 0 1 3-2l2 2"/>',
  '录制': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor"/>',
  'AE': '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 16l2.5-8L12 16M7.8 13.5h3.4M15 12.5h4a2 2 0 0 0-4 0v1a2 2 0 0 0 3.5 1.3"/>',
  '3D': '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M3 7l9 5 9-5"/>',
  'H5': '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  '结束': '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  '高级': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 10h.1a2 2 0 1 1 0 4z"/>',
};
const iconFor = name => { const k = Object.keys(ICONS).find(k => name.includes(k)); return k ? `<svg class="ico" viewBox="0 0 24 24" ${P}>${ICONS[k]}</svg>` : ''; };
const CHEV = `<svg class="chev" viewBox="0 0 24 24" ${P}><path d="M9 6l6 6-6 6"/></svg>`;

export function enhanceSections(root) {
  for (const d of root.querySelectorAll(':scope > details')) {
    const s = d.querySelector(':scope > summary'); if (!s || s.dataset.fx) continue; s.dataset.fx = '1';
    const name = s.textContent; s.innerHTML = `${iconFor(name)}<span class="sum-t">${name}</span>${CHEV}`;
    const body = document.createElement('div'); body.className = 'sec-body';
    [...d.childNodes].filter(n => n !== s).forEach(n => body.appendChild(n)); d.appendChild(body);
    s.addEventListener('click', e => {
      e.preventDefault(); if (d.dataset.anim) return; d.dataset.anim = '1';
      const rows = body.querySelectorAll(':scope > .row, :scope > .advSub, :scope > .theme-picker');
      if (!d.open) {
        d.open = true; d.dispatchEvent(new Event('toggle'));
        gsap.fromTo(body, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: D(0.34), ease: 'power2.out', clearProps: 'height,opacity', onComplete: () => delete d.dataset.anim });
        if (rows.length) gsap.fromTo(rows, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: D(0.28), stagger: D(Math.min(0.025, 0.3 / rows.length)), ease: 'power2.out', clearProps: 'transform,opacity' });
      } else {
        gsap.to(body, { height: 0, opacity: 0, duration: D(0.26), ease: 'power2.in', onComplete: () => { d.open = false; gsap.set(body, { clearProps: 'height,opacity' }); delete d.dataset.anim; d.dispatchEvent(new Event('toggle')); } });
      }
    });
  }
  bindPress(root);
}
export function bindPress(root) {
  for (const b of root.querySelectorAll('button:not([data-fx])')) {
    b.dataset.fx = '1';
    b.addEventListener('pointerdown', () => gsap.to(b, { scale: 0.95, duration: D(0.08) }));
    const up = () => gsap.to(b, { scale: 1, duration: D(0.35), ease: 'back.out(3)' });
    b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up);
  }
}
export function panelEntrance() {
  if (RM()) return;
  gsap.from('#panel', { x: 40, opacity: 0, duration: 0.5, ease: 'power3.out', clearProps: 'transform,opacity' });
  gsap.from('#panelHead .btns button', { y: 10, opacity: 0, duration: 0.35, stagger: 0.03, delay: 0.15, ease: 'power2.out', clearProps: 'transform,opacity' });
}
// 滑动开关：保留原 checkbox（data-key 不变），role=switch + aria-checked；拇指用 GSAP 弹性移动
export function makeSwitch(inp) {
  const w = document.createElement('span'); w.className = 'switch'; inp.classList.add('switch-input'); inp.setAttribute('role', 'switch');
  const sl = document.createElement('span'); sl.className = 'slider'; const th = document.createElement('span'); th.className = 'thumb'; sl.appendChild(th); w.append(inp, sl);
  const sync = anim => { inp.setAttribute('aria-checked', inp.checked ? 'true' : 'false'); gsap.to(th, { x: inp.checked ? 18 : 0, duration: anim ? D(0.32) : 0, ease: 'back.out(2)' }); gsap.fromTo(th, { scaleX: 1.25 }, { scaleX: 1, duration: anim ? D(0.3) : 0 }); };
  inp.addEventListener('change', () => sync(true)); sync(false); return w;
}
// 主题选择卡片：隐藏原 select（data-key 保留），卡片点击写回 select 并派发 change
const PREVIEW = { 'original-ui': 'radial-gradient(circle at 70% 60%,#2f3a6b 0 14%,transparent 15%),linear-gradient(135deg,#bff0e3 0 40%,#c9e4ff 40% 70%,#d9d2fb 70%)', default: 'linear-gradient(135deg,#b98a55 0 45%,#7a5233 45% 100%)', realistic: 'radial-gradient(circle at 35% 35%,#e9e3d8 0 18%,#9ea3a9 19% 30%,transparent 31%),repeating-linear-gradient(90deg,#d6cab4 0 2px,#c8bba3 2px 4px)' };
export function themePicker(sel, options) {
  const box = document.createElement('div'); box.className = 'theme-picker'; box.setAttribute('role', 'radiogroup');
  for (const [v, l] of options) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'theme-card'; b.dataset.theme = v; b.setAttribute('role', 'radio');
    b.innerHTML = `<span class="sw" style="background:${PREVIEW[v] || '#555'}"></span><span class="tn">${l}</span>`;
    b.onclick = e => { e.preventDefault(); sel.value = v; sel.dispatchEvent(new Event('change')); mark(); gsap.fromTo(b, { scale: 0.94 }, { scale: 1, duration: D(0.4), ease: 'back.out(3)' }); };
    box.appendChild(b);
  }
  const mark = () => box.querySelectorAll('.theme-card').forEach(b => { const on = b.dataset.theme === sel.value; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  mark(); sel.classList.add('sr-hidden'); box.appendChild(sel); return box;
}
