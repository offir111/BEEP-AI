import numpy as np, math
from PIL import Image, ImageDraw, ImageFont

orig = Image.open(r"C:\Users\Admin\Desktop\beep-ai\public\roadrunner-logo.png").convert("RGB")
arr = np.asarray(orig).astype(float)/255.0
def cl(a): return np.clip(a,0,1)
arr = cl(1-arr)                                   # invert()
a=0.68; inv=1-a
Msep=np.array([[0.393+0.607*inv,0.769-0.769*inv,0.189-0.189*inv],
 [0.349-0.349*inv,0.686+0.314*inv,0.168-0.168*inv],
 [0.272-0.272*inv,0.534-0.534*inv,0.131+0.869*inv]])
arr=cl(arr@Msep.T)                                # sepia(0.68)
s=1.44
Msat=np.array([[0.213+0.787*s,0.715-0.715*s,0.072-0.072*s],
 [0.213-0.213*s,0.715+0.285*s,0.072-0.072*s],
 [0.213-0.213*s,0.715-0.715*s,0.072+0.928*s]])
arr=cl(arr@Msat.T)                                # saturate(1.44)
c=math.cos(math.radians(5)); sn=math.sin(math.radians(5))
Mhue=np.array([[0.213+c*0.787-sn*0.213,0.715-c*0.715-sn*0.715,0.072-c*0.072+sn*0.928],
 [0.213-c*0.213+sn*0.143,0.715+c*0.285+sn*0.140,0.072-c*0.072-sn*0.283],
 [0.213-c*0.213-sn*0.787,0.715-c*0.715+sn*0.715,0.072+c*0.928+sn*0.072]])
arr=cl(arr@Mhue.T)                                # hue-rotate(5deg)
gold=Image.fromarray((arr*255).astype('uint8'),"RGB")

# bird bbox (non-white in original)
gray=np.asarray(orig).mean(2)
ys,xs=np.where(gray<230)
bb=(xs.min(),ys.min(),xs.max()+1,ys.max()+1)
goldbird=gold.crop(bb)

# upscale bird smoothly
S=1024; D=S; cx=cy=S//2; R=int(S*0.5)-2
canvas=Image.new("RGBA",(S,S),(0,0,0,0)); d=ImageDraw.Draw(canvas)
d.ellipse([cx-R,cy-R,cx+R,cy+R],fill=(0,0,0,255))   # black circle

Wb=int(0.64*S); Hb=int(Wb*goldbird.height/goldbird.width)
bird=goldbird.resize((Wb,Hb),Image.LANCZOS)
canvas.alpha_composite(bird.convert("RGBA"),(cx-Wb//2, int(0.20*S)))

font=ImageFont.truetype("Rubik.ttf",int(0.155*S))
try:font.set_variation_by_axes([800])
except:pass
t1,t2="BEEP ","AI"
w1=d.textlength(t1,font=font); w2=d.textlength(t2,font=font)
tx=cx-(w1+w2)/2; ty=int(0.66*S)
d.text((tx,ty),t1,font=font,fill=(255,255,255,255))
d.text((tx+w1,ty),t2,font=font,fill=(255,207,0,255))

out=canvas.resize((512,512),Image.LANCZOS)
out.save(r"C:\Users\Admin\Desktop\beep-ai\public\beep-ai-logo.png")
# preview on neutral bg
pv=Image.new("RGB",(560,560),(40,42,55)); pv.paste(out,(24,24),out); pv.save("circle_preview.png")
print("ok, gold sample:", gold.crop(bb).resize((1,1)).getpixel((0,0)))
