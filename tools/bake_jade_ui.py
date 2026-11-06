# phase34: jade plaque (text inpainted) + pause button from the user's jade reference
from PIL import Image; import numpy as np, cv2, sys
r = np.asarray(Image.open(sys.argv[1]).convert('RGB')); out = sys.argv[2]
def rr(h, w, x0, y0, x1, y1, rad):
  m = np.zeros((h, w), np.uint8); cv2.rectangle(m, (x0 + rad, y0), (x1 - rad, y1), 255, -1); cv2.rectangle(m, (x0, y0 + rad), (x1, y1 - rad), 255, -1)
  for cx, cy in ((x0 + rad, y0 + rad), (x1 - rad, y0 + rad), (x0 + rad, y1 - rad), (x1 - rad, y1 - rad)): cv2.circle(m, (cx, cy), rad, 255, -1)
  return m
# plaque: abs crop 760..1400 x 60..255
c = r[60:255, 760:1400].copy(); h, w = c.shape[:2]
a = rr(h, w, 52, 8, 588, 188, 80)
for cx in (48, 592): cv2.ellipse(a, (cx, 98), (40, 50), 0, 0, 360, 255, -1)
f = c.astype(int); lum = 0.3 * f[..., 0] + 0.59 * f[..., 1] + 0.11 * f[..., 2]
txt = np.zeros((h, w), np.uint8); txt[25:135, 120:520] = (lum[25:135, 120:520] > 125); txt = cv2.dilate(txt, np.ones((15, 15), np.uint8))
c = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(c, cv2.COLOR_RGB2BGR), txt * 255, 9, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
Image.fromarray(np.dstack([c, cv2.GaussianBlur(a, (5, 5), 0)]), 'RGBA').save(out + '/plaque.webp', quality=90)
# pause: abs 1808..2080 x 42..302
p = r[42:302, 1808:2080].copy(); h, w = p.shape[:2]
Image.fromarray(np.dstack([p, cv2.GaussianBlur(rr(h, w, 8, 6, w - 14, h - 12, 60), (5, 5), 0)]), 'RGBA').save(out + '/pause.webp', quality=90)
print('ok')
