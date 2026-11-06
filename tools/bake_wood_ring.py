# phase32: unwrap the wood reference red ring tube into a tint-neutral detail strip (polar -> rect)
from PIL import Image; import numpy as np, cv2, base64, sys
r=np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.float32)
cx,cy,R0=489.0,622.9,236.0
U0,U1,V0,V1=60,620,7,103
a0=np.radians(95); L=700; V=110
uu,vv=np.meshgrid(np.arange(L),np.arange(V)); ang=a0+uu/R0; rad=R0-55+vv
s=cv2.remap(r,(cx+rad*np.cos(ang)).astype(np.float32),(cy+rad*np.sin(ang)).astype(np.float32),cv2.INTER_LINEAR)[V0:V1,U0:U1]
Y=s@np.array([0.299,0.587,0.114],np.float32)
P=np.median(Y,axis=1)                       # cross-section profile (rows = inner->outer)
D=Y/P[:,None]
n=D.shape[1]; F=60                           # seamless loop: crossfade last F cols into first
w=np.linspace(0,1,F)[None,:]; D[:,:F]=D[:,:F]*w+D[:,-F:]*(1-w); D=D[:,:-F]
Ym=np.median(P[len(P)//4:3*len(P)//4]); Pn=P/Ym
b=np.clip(D*100,0,255).astype(np.uint8)
pr=np.clip(Pn*100,0,255).astype(np.uint8)
open(sys.argv[2],'w').write(f"// phase32: baked from wood reference (tools/bake_wood_ring.py) — tint-neutral tube detail strip\nexport const WR_W = {b.shape[1]}, WR_H = {b.shape[0]};\nexport const WR_D = '{base64.b64encode(b.tobytes()).decode()}';\nexport const WR_P = '{base64.b64encode(pr.tobytes()).decode()}';\n")
print(b.shape, Pn.round(2)[::8])
Image.fromarray(np.clip(D*120,0,255).astype(np.uint8)).save('/tmp/strip_D.png')
