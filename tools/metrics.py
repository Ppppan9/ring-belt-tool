import json,numpy as np
from PIL import Image,ImageDraw,ImageFont
M=json.load(open('compare/meta.json'))['meta']
def box(a,k=7):
    c=np.cumsum(np.cumsum(np.pad(a,((1,0),(1,0))),0),1); return (c[k:,k:]-c[:-k,k:]-c[k:,:-k]+c[:-k,:-k])/(k*k)
def ssim(x,y):
    C1,C2=(0.01*255)**2,(0.03*255)**2; mx,my=box(x),box(y); sx=box(x*x)-mx*mx; sy=box(y*y)-my*my; sxy=box(x*y)-mx*my
    return float(np.mean(((2*mx*my+C1)*(2*sxy+C2))/((mx*mx+my*my+C1)*(sx+sy+C2))))
def psnr(x,y): m=np.mean((x-y)**2); return float(10*np.log10(255**2/max(m,1e-9)))
try: F=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',40)
except Exception: F=ImageFont.load_default()
rows=[]
for m in M:
    if m['rep'] is None: continue
    a=Image.open(f"compare/raw/ref_{m['i']}.png").convert('RGB').resize((864,1920)); b=Image.open(f"compare/raw/rep_{m['i']}.png").convert('RGB').resize((864,1920))
    # 结构比较：灰度、1/4 分辨率（美术配色不同，降低色彩影响）
    ga=np.asarray(a.convert('L').resize((216,480)),float); gb=np.asarray(b.convert('L').resize((216,480)),float)
    s,p=ssim(ga,gb),psnr(np.asarray(a,float),np.asarray(b,float))
    # 布局：边缘图 IoU（Sobel 阈值）
    def edge(g): gx=np.abs(np.diff(g,axis=1))[:-1]; gy=np.abs(np.diff(g,axis=0))[:,:-1]; return (gx+gy)>25
    ea,eb=edge(ga),edge(gb); iou=float((ea&eb).sum()/max((ea|eb).sum(),1))
    c=Image.new('RGB',(864*2+20,1920+70),(30,30,30)); c.paste(a,(0,70)); c.paste(b,(884,70)); d=ImageDraw.Draw(c)
    d.text((10,10),f"参考 t={m['rt']:.2f}s",fill='white',font=F); d.text((894,10),f"复刻 t={m['rep']:.2f}s  {m['lab']}  SSIM {s:.3f} PSNR {p:.1f}dB",fill='white',font=F)
    fn=f"compare/{m['i']:02d}_{m['lab']}.png"; c.save(fn); rows.append((m['lab'],m['rt'],m['rep'],s,p,iou,fn))
with open('compare/metrics.md','w') as f:
    f.write('| 时刻 | 参考t | 复刻t | SSIM(灰度1/4) | PSNR(dB) | 边缘IoU | 图 |\n|---|---|---|---|---|---|---|\n')
    for r in rows: f.write(f'| {r[0]} | {r[1]:.2f} | {r[2]:.2f} | {r[3]:.3f} | {r[4]:.1f} | {r[5]:.3f} | {r[6]} |\n')
    f.write(f'| **平均** | | | {np.mean([r[3] for r in rows]):.3f} | {np.mean([r[4] for r in rows]):.1f} | {np.mean([r[5] for r in rows]):.3f} | |\n')
print(open('compare/metrics.md').read())
