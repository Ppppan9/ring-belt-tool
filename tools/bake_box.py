# phase33: cut candy reference boxes/trays as alpha sprites; missing colours = HSV hue-shift of a same-type master
from PIL import Image; import numpy as np, cv2, sys, colorsys
im=np.asarray(Image.open(sys.argv[1]).convert('RGB')); out=sys.argv[2]; PFX=sys.argv[3] if len(sys.argv)>3 else ''
Q={'cyan':(211,3027),'blue':(1092,3026),'purple':(211,3224),'red':(650,3224),'green':(1536,3225)}
T={'green':(212,2840),'orange':(651,2839),'purple':(1093,2840)}
QW,QH,TW,TH=413,186,411,176
if PFX=='jade':
  Q={'cyan':(186,2936),'blue':(1094,2936),'red':(1550,2936),'purple':(186,3138),'green':(1549,3138),'orange':(1549,3347)}; T={'green':(187,2746),'orange':(641,2746),'purple':(1098,2746)}; QW,QH,TW,TH=425,186,420,172
TARGET={'red':(252,70,83),'blue':(73,141,251),'green':(42,222,120),'yellow':(255,205,40),'purple':(165,89,250),'orange':(254,147,60),'cyan':(53,203,253)}
M=12
def cut(x,y,w,h):
  c=im[y-M:y+h+M, x-M:x+w+M].copy(); f=c.astype(int); sat=f.max(2)-f.min(2)
  R,G,B=f[...,0],f[...,1],f[...,2]; m=((sat>90)&~((R>G)&(G>B)&(R-B<150)&(B>60))).astype(np.uint8) if PFX!='jade' else (sat>80).astype(np.uint8)
  n,lab,st,_=cv2.connectedComponentsWithStats(m); k=1+np.argmax(st[1:,4]); m=(lab==k).astype(np.uint8)
  m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((9,9),np.uint8)); cs,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE); m=np.zeros_like(m); cv2.drawContours(m,cs,-1,1,-1)
  m=cv2.dilate(m,np.ones((7,7),np.uint8)); a=cv2.GaussianBlur(m*255,(5,5),0)
  return c,a
def shift(c,src,dst):
  hsv=cv2.cvtColor(c,cv2.COLOR_RGB2HSV).astype(np.float32)
  hs=cv2.cvtColor(np.uint8([[src]]),cv2.COLOR_RGB2HSV)[0,0].astype(float); hd=cv2.cvtColor(np.uint8([[dst]]),cv2.COLOR_RGB2HSV)[0,0].astype(float)
  hsv[...,0]=(hsv[...,0]+hd[0]-hs[0])%180; hsv[...,1]=np.clip(hsv[...,1]*hd[1]/max(hs[1],1),0,255); hsv[...,2]=np.clip(hsv[...,2]*hd[2]/max(hs[2],1),0,255)
  return cv2.cvtColor(hsv.astype(np.uint8),cv2.COLOR_HSV2RGB)
for kind,src,master,W,H in (('q',Q,'cyan',QW,QH),('t',T,'green',TW,TH)):
  for col,tgt in TARGET.items():
    if col not in src: continue  # 缺色运行时 hue 换色
    if col in src: c,a=cut(*src[col],W,H)
    else:
      ms=master if not (kind=='q' and col in ('yellow','orange')) else 'green'; c,a=cut(*src[ms],W,H); c=shift(c,TARGET[ms],tgt)
    Image.fromarray(np.dstack([c,a]),'RGBA').reduce(2).save(f'{out}/{kind}_{col}.webp',quality=80)
print('ok', W+2*M, H+2*M)
