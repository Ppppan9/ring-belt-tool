# phase32: cut the big/small gold clips from the wood reference as alpha sprites
from PIL import Image; import numpy as np, cv2, sys
im=Image.open(sys.argv[1]).convert('RGB'); r=np.asarray(im).astype(int)
x0,y0,x1,y1=660,545,845,690
c=r[y0:y1,x0:x1]; R,G,B=c[...,0],c[...,1],c[...,2]
m=((R>110)&(G>85)&(B<0.75*G)&(R-B>60)&(G>0.6*R)).astype(np.uint8)
m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((17,17),np.uint8))
cs,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
for name,(a,b) in {'clip_big':(0,116),'clip_small':(116,177)}.items():
  mm=np.zeros_like(m)
  for ct in cs:
    X,Y,W,H=cv2.boundingRect(ct)
    if W*H>2000: cv2.drawContours(mm,[ct],-1,1,-1)
  mm[:, :a]=0; mm[:, b:]=0; mm[:12]=0; mm[135:]=0
  mm=cv2.morphologyEx(mm,cv2.MORPH_OPEN,np.ones((5,5),np.uint8))
  ys,xs=np.nonzero(mm); X0,X1,Y0,Y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
  al=cv2.GaussianBlur((mm*255).astype(np.uint8),(3,3),0)
  rgba=np.dstack([c.astype(np.uint8),al])[Y0:Y1,X0:X1]
  Image.fromarray(rgba,'RGBA').save(f'{sys.argv[2]}/{name}.webp',quality=95,lossless=False); print(name,X1-X0,Y1-Y0)
