from PIL import Image, ImageDraw, ImageFont
bird=Image.open(r"C:\Users\Admin\Desktop\beep-ai\public\beep-ai-bird.png").convert("RGBA")

SS=2
W,H=760*SS,80*SS
im=Image.new("RGBA",(W,H),(18,18,26,255))  # header bg (var --bg-secondary)
d=ImageDraw.Draw(im)
# brand box black, rounded-left
bx0,by0,bx1,by1 = 0,0,150*SS,H
d.rounded_rectangle([bx0,by0,bx1,by1],radius=10*SS,fill=(0,0,0,255))
d.rectangle([bx0,by0,bx0+12*SS,by1],fill=(0,0,0,255))  # square left edge fill

# logo image: height ~44
lh=44*SS; lw=int(bird.width*lh/bird.height)
logo=bird.resize((lw,lh),Image.LANCZOS)
lx=12*SS; ly=6*SS
im.alpha_composite(logo,(lx,ly))

# BEEP AI text below in Rubik
f=ImageFont.truetype("Rubik.ttf",int(17*SS))
try:f.set_variation_by_axes([800])
except:pass
t1,t2="BEEP ","AI"
w1=d.textlength(t1,font=f); w2=d.textlength(t2,font=f)
cx=(bx1)//2; ty=H-26*SS
tx=cx-(w1+w2)/2
d.text((tx,ty),t1,font=f,fill=(255,255,255,255))
d.text((tx+w1,ty),t2,font=f,fill=(255,207,0,255))

# fake right side (clock/bell/user) for realism
fr=ImageFont.truetype("Rubik.ttf",int(12*SS))
d.text((W-150*SS,H//2-7*SS),"08:08 IST",font=fr,fill=(150,150,160,255))
d.ellipse([W-44*SS,H//2-12*SS,W-20*SS,H//2+12*SS],fill=(212,175,55,255))
d.text((W-36*SS,H//2-8*SS),"O",font=fr,fill=(0,0,0,255))

im.convert("RGB").resize((760,80),Image.LANCZOS).save("header_sim.png")
print("ok")
