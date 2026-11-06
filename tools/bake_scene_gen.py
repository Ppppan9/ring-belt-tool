# phase34: jade scene = piece-free edit of user's jade reference, tone-matched to the reference, vertical 9-slice to our 9:20 canvas
from PIL import Image; import numpy as np, cv2, sys
ref = np.asarray(Image.open(sys.argv[1]).convert('RGB').resize((864, 1536), Image.LANCZOS)); g = np.asarray(Image.open(sys.argv[2]).convert('RGB').resize((864, 1536), Image.LANCZOS))
Lr, Lg = [cv2.cvtColor(a, cv2.COLOR_RGB2LAB).astype(np.float32) for a in (ref, g)]
def st(L, ys, xs): v = L[ys, xs].reshape(-1, 3); return np.median(v, 0), v.std(0) + 1e-3
out = Lg.copy()
for ys, xs in ((slice(820, 880), slice(60, 300)), (slice(0, 60), slice(0, 864))):  # plank / backdrop
  pass
mr, sr = st(Lr, slice(806, 818), slice(60, 800)); mg, sg = st(Lg, slice(806, 818), slice(60, 800))
board = (Lg - mg) * np.clip(sr / sg, 0.7, 1.4) + mr
mr2, _ = st(Lr, slice(0, 50), slice(300, 560)); mg2, _ = st(Lg, slice(0, 50), slice(300, 560))
back = Lg - mg2 + mr2
inner = np.zeros(g.shape[:2], np.float32); inner[130:880, 30:834] = 1; inner[930:1520, 30:834] = 1; inner = cv2.GaussianBlur(inner, (0, 0), 12)[..., None]
out = board * inner + back * (1 - inner)
o = cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)
K = [(0, 0), (215, 72), (305, 162), (1030, 797), (1250, 1017), (1760, 1400), (1920, 1536)]
sy = np.interp(np.arange(1920), [k[0] for k in K], [k[1] for k in K]).astype(np.float32)
mx, my = np.meshgrid(np.arange(864, dtype=np.float32), sy)
Image.fromarray(cv2.remap(o, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)).save(sys.argv[3], quality=int(sys.argv[4]) if len(sys.argv) > 4 else 80)
