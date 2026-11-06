# phase33: bake candy reference belt body (purple rounded slab); holes/rod/beads inpainted (game draws its own)
from PIL import Image; import numpy as np, cv2, sys
r=np.asarray(Image.open(sys.argv[1]).convert('RGB'))
x0,y0,x1,y1=149,2484,2007,2816; M=24
X0,Y0,X1,Y1=x0-M,y0-M,x1+M,y1+M
c=r[Y0:Y1,X0:X1].copy(); f=c.astype(int); R,G,B=f[...,0],f[...,1],f[...,2]; H,W=c.shape[:2]
hh=(y1-y0)//2; cy=M+hh
face=np.zeros((H,W),np.uint8); cv2.rectangle(face,(M+hh,M+18),(W-M-hh,H-M-18),1,-1)
for cx in (M+hh,W-M-hh): cv2.circle(face,(cx,cy),hh-18,1,-1)
lum=0.3*R+0.59*G+0.11*B; sat=f.max(2)-f.min(2)
bad=((lum<95)|(sat<70)).astype(np.uint8)&face
bad=cv2.dilate(bad,np.ones((11,11),np.uint8))
o=cv2.cvtColor(cv2.inpaint(cv2.cvtColor(c,cv2.COLOR_RGB2BGR),bad*255,15,cv2.INPAINT_TELEA),cv2.COLOR_BGR2RGB)
bl=cv2.GaussianBlur(o,(0,0),14); fm=cv2.GaussianBlur(face.astype(np.float32),(0,0),6)[...,None]; o=(o*(1-fm)+bl*fm).astype(np.uint8)
al=np.zeros((H,W),np.uint8); cv2.rectangle(al,(M+hh,M),(W-M-hh,H-M),255,-1)
for cx in (M+hh,W-M-hh): cv2.circle(al,(cx,cy),hh,255,-1)
al=cv2.GaussianBlur(al,(5,5),0)
Image.fromarray(np.dstack([o,al]),'RGBA').reduce(3).save(sys.argv[2],quality=70); print(W,H)
