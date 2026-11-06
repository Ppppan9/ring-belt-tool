# phase38: candy reference red ball -> tint-neutral shade map (multiply) + white specular map (screen-over), runtime tinted per colour
from PIL import Image; import numpy as np, cv2, sys
r = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.float32)
cx, cy, R = 536.0, 754.0, 43.0; N = 128
xs = np.linspace(-1, 1, N); X, Y = np.meshgrid(xs, xs)
src = cv2.remap(r, (cx + X * R).astype(np.float32), (cy + Y * R).astype(np.float32), cv2.INTER_CUBIC)
L = src @ np.array([0.299, 0.587, 0.114], np.float32); d = np.hypot(X, Y)
Lb = np.median(L[(d < 0.75)])
S = np.clip(L / Lb, 0, 1); H = np.clip((L / Lb - 1.05) / 0.9, 0, 1)
a = np.clip((1 - d) * N / 2 * 0.9, 0, 1)
out = sys.argv[2]
Image.fromarray(np.dstack([S * 255] * 3 + [a * 255]).astype(np.uint8), 'RGBA').save(out + '/ball_shade.webp', quality=92)
Image.fromarray(np.dstack([np.full_like(H, 255)] * 3 + [H * a * 255]).astype(np.uint8), 'RGBA').save(out + '/ball_spec.webp', quality=92)
print('Lb', Lb, 'spec max', H.max())
