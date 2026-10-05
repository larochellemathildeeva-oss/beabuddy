"""Pack the globe's relief texture: R = elevation, G = ocean mask, B = sparse clouds.
Sources (NASA, public domain): earth-topology.png + earth-water.png (three-globe examples,
from NASA Blue Marble), cloud_combined_2048.jpg (NASA Visible Earth #57747).
Run from a folder holding those three files; writes relief.webp (→ public/earth/relief.webp)."""
from PIL import Image, ImageFilter
import numpy as np, sys
W,H=2048,1024
topo=np.asarray(Image.open('earth-topology.png').convert('L').resize((W,H),Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.6))).astype(np.float32)/255
topo=topo**0.85  # lift low hills a little so the relief reads at phone size
water=np.asarray(Image.open('earth-water.png').convert('L').resize((W,H),Image.LANCZOS)).astype(np.float32)/255
cl=np.asarray(Image.open('cloud_combined_2048.jpg').convert('L').resize((W,H),Image.LANCZOS)).astype(np.float32)/255
rng=np.random.default_rng(11)
n=rng.random((24,48)).astype(np.float32)
nm=np.asarray(Image.fromarray((n*255).astype(np.uint8)).resize((W,H),Image.BICUBIC).filter(ImageFilter.GaussianBlur(14))).astype(np.float32)/255
nm=(nm-nm.min())/(nm.max()-nm.min())
mask=np.clip((nm-0.5)/0.1,0,1)
c=np.clip((cl-0.42)/0.35,0,1)**1.1*mask
lat=np.linspace(90,-90,H)[:,None]
c*=np.clip((62-np.abs(lat))/14,0,1)
print('cloud coverage', (c>0.25).mean())
rgb=np.stack([topo,water,c],-1)
Image.fromarray((rgb*255+0.5).astype(np.uint8)).save('relief.webp',quality=92,method=6)
Image.fromarray((c*255).astype(np.uint8)).resize((1024,512)).save('clouds_preview.jpg')
