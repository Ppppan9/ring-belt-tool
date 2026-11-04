import sys,numpy as np
from PIL import Image
from scipy import ndimage
def red(path,y0,y1):
  a=np.asarray(Image.open(path).convert('RGB')).astype(int)[y0:y1]
  r,g,b=a[...,0],a[...,1],a[...,2]
  m=(r>150)&(r-g>90)&(r-b>50)
  lab,n=ndimage.label(m); out=[]
  for i,s in enumerate(ndimage.find_objects(lab)):
    h=s[0].stop-s[0].start;w=s[1].stop-s[1].start;area=(lab[s]==i+1).sum()
    if area>200: out.append((s[1].start,s[0].start+y0,w,h,area,tuple(a[s][lab[s]==i+1].mean(0).astype(int))))
  return out
for p in sys.argv[1:]:
  print(p)
  for o in sorted(red(p,1200,1700),key=lambda o:(o[1]//40,o[0]))[:14]: print('  ',o)
