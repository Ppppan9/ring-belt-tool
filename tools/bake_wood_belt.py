# phase32: bake the wood reference belt body (gold frame + purple face + end ornaments); holes/rod/beads inpainted away (game draws its own)
from PIL import Image; import numpy as np, cv2, sys
r=np.asarray(Image.open(sys.argv[1]).convert('RGB'))
X0,Y0,X1,Y1=100,2362,2060,2738
c=r[Y0:Y1,X0:X1].copy(); f=c.astype(int); R,G,B=f[...,0],f[...,1],f[...,2]
H,W=c.shape[:2]
face=np.zeros((H,W),np.uint8); cv2.rectangle(face,(160-X0+150,2378-Y0+22),(1996-X0-150,2722-Y0-22),1,-1)
for cx in (160-X0+172,1996-X0-172): cv2.circle(face,(cx,(2378+2722)//2-Y0),150,1,-1)
lum=0.3*R+0.59*G+0.11*B
bad=((lum<92)|(lum>185)|((R>140)&(G>110)&(B<G*0.8))|((R>B)&(G>B*0.9))).astype(np.uint8)&face
bad=cv2.dilate(bad,np.ones((9,9),np.uint8))
out=cv2.inpaint(cv2.cvtColor(c,cv2.COLOR_RGB2BGR),bad*255,12,cv2.INPAINT_TELEA)
out=cv2.cvtColor(out,cv2.COLOR_BGR2RGB)
# alpha: frame rounded rect + ornaments (keep where not wood-brown background)
al=np.zeros((H,W),np.uint8); cv2.rectangle(al,(160-X0+172,2378-Y0),(1996-X0-172,2722-Y0),255,-1)
for cx in (160-X0+172,1996-X0-172): cv2.circle(al,(cx,(2378+2722)//2-Y0),172,255,-1)
orn=((R>120)&(G>90)&(B<G*0.75)&(R-B>60)).astype(np.uint8); orn[:, 160-X0+20:1996-X0-20]=0; cy0=(2378+2722)//2-Y0; orn[:cy0-70]=0; orn[cy0+70:]=0
orn=cv2.morphologyEx(orn,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))*255
al=np.maximum(al,orn); al=cv2.GaussianBlur(al,(3,3),0)
Image.fromarray(np.dstack([out,al]),'RGBA').save(sys.argv[2],quality=92)
print(W,H,'frame box in img',160-X0,2378-Y0,1996-X0,2722-Y0)
