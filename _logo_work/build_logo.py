from PIL import Image, ImageDraw, ImageFont

SS = 2
S  = 512 * SS
C  = S // 2

# bird: UPSCALE first (smooth edges), THEN flood-fill outer white bg
base = Image.open(r"C:\Users\Admin\Desktop\beep-ai\public\roadrunner-logo.png").convert("RGB")
bw = int(310*SS)
bh = int(bw*base.height/base.width)
big = base.resize((bw,bh), Image.LANCZOS)
SENT=(255,0,255)
for corner in [(0,0),(bw-1,0),(0,bh-1),(bw-1,bh-1)]:
    ImageDraw.floodfill(big, corner, SENT, thresh=60)
bird = big.convert("RGBA")
bp = bird.load()
for y in range(bh):
    for x in range(bw):
        if bird.getpixel((x,y))[:3]==SENT:
            bp[x,y]=(0,0,0,0)

canvas = Image.new("RGBA", (S, S), (0,0,0,0))
d = ImageDraw.Draw(canvas)
R=int(250*SS)
d.ellipse([C-R,C-R,C+R,C+R], fill=(13,13,18,255))
ring_w=int(13*SS); rr=R-ring_w//2-int(2*SS)
d.ellipse([C-rr,C-rr,C+rr,C+rr], outline=(255,207,0,255), width=ring_w)

CY=(0,229,255,255); BL=(41,98,255,255); OR=(255,122,0,255)
for x,y,s,col in [
 (118,150,16,CY),(108,176,15,BL),(104,202,16,OR),(122,222,13,CY),
 (88,152,12,OR),(84,184,13,CY),(92,212,12,BL),(100,234,11,CY),
 (66,162,9,CY),(61,194,9,OR),(71,220,8,BL),(50,180,7,CY),
 (38,172,6,OR),(44,206,5,CY),(28,190,5,BL)]:
    x*=SS;y*=SS;s*=SS
    d.rectangle([x,y,x+s,y+s], fill=col)

canvas.alpha_composite(bird,(C-bw//2,int(165*SS)))

font=ImageFont.truetype("Rubik.ttf",int(62*SS))
try: font.set_variation_by_axes([800])
except Exception as e: print("var",e)
t1,t2="BEEP ","AI"
w1=d.textlength(t1,font=font); w2=d.textlength(t2,font=font)
tx=C-(w1+w2)/2; ty=int(352*SS)
d.text((tx,ty),t1,font=font,fill=(255,255,255,255))
d.text((tx+w1,ty),t2,font=font,fill=(255,138,0,255))

out=canvas.resize((512,512), Image.LANCZOS)
out.save("preview_logo.png"); print("saved",out.size)
