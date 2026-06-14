from PIL import Image, ImageDraw, ImageFont

SS=2; S=512*SS; C=S//2
CY=(0,229,255,255); BL=(41,98,255,255); OR=(255,122,0,255)
FONT=lambda px:_f(px)
_cache={}
def _f(px):
    if px not in _cache:
        f=ImageFont.truetype("Rubik.ttf",px)
        try:f.set_variation_by_axes([800])
        except:pass
        _cache[px]=f
    return _cache[px]

# key the bird once at high res
base=Image.open(r"C:\Users\Admin\Desktop\beep-ai\public\roadrunner-logo.png").convert("RGB")
BW=int(420*SS); BH=int(BW*base.height/base.width)
big=base.resize((BW,BH),Image.LANCZOS)
SENT=(255,0,255)
for c in [(0,0),(BW-1,0),(0,BH-1),(BW-1,BH-1)]:
    ImageDraw.floodfill(big,c,SENT,thresh=60)
bird_src=big.convert("RGBA")
bp=bird_src.load()
for y in range(BH):
    for x in range(BW):
        if bird_src.getpixel((x,y))[:3]==SENT: bp[x,y]=(0,0,0,0)

SQ_FULL=[(118,150,16,CY),(108,176,15,BL),(104,202,16,OR),(122,222,13,CY),
 (88,152,12,OR),(84,184,13,CY),(92,212,12,BL),(100,234,11,CY),
 (66,162,9,CY),(61,194,9,OR),(71,220,8,BL),(50,180,7,CY),
 (38,172,6,OR),(44,206,5,CY),(28,190,5,BL)]
SQ_MED=[(118,150,15,CY),(104,202,16,OR),(88,180,13,BL),(100,234,11,CY),
 (66,168,10,CY),(61,200,9,OR),(40,186,7,BL),(50,160,8,CY)]
SQ_SPARSE=[(112,165,18,CY),(96,205,17,OR),(74,185,13,BL),(56,210,10,CY),(46,170,8,OR)]

def make(bird_w, squares, ai_col, tsize, by):
    cv=Image.new("RGBA",(S,S),(0,0,0,0)); d=ImageDraw.Draw(cv)
    R=int(250*SS); d.ellipse([C-R,C-R,C+R,C+R],fill=(13,13,18,255))
    rw=int(13*SS); rr=R-rw//2-int(2*SS)
    d.ellipse([C-rr,C-rr,C+rr,C+rr],outline=(255,207,0,255),width=rw)
    for x,y,s,col in squares:
        x*=SS;y*=SS;s*=SS; d.rectangle([x,y,x+s,y+s],fill=col)
    bw=int(bird_w*SS); bh=int(bw*bird_src.height/bird_src.width)
    bird=bird_src.resize((bw,bh),Image.LANCZOS)
    cv.alpha_composite(bird,(C-bw//2,int(by*SS)))
    f=_f(int(tsize*SS)); t1,t2="BEEP ","AI"
    w1=d.textlength(t1,font=f); w2=d.textlength(t2,font=f)
    tx=C-(w1+w2)/2; ty=int(352*SS)
    d.text((tx,ty),t1,font=f,fill=(255,255,255,255))
    d.text((tx+w1,ty),t2,font=f,fill=ai_col)
    return cv.resize((512,512),Image.LANCZOS)

v1=make(310,SQ_FULL,(255,138,0,255),62,165)        # full pixels, AI orange
v2=make(370,SQ_SPARSE,(255,207,0,255),58,150)       # big bird, few pixels, AI yellow
v3=make(335,SQ_MED,(0,229,255,255),66,158)          # medium, AI cyan

# montage
each=360; gap=24; labelh=54
W=each*3+gap*4; Hm=each+gap+labelh
m=Image.new("RGBA",(W,Hm),(244,244,248,255)); md=ImageDraw.Draw(m)
lf=_f(40)
for i,v in enumerate([v1,v2,v3]):
    vr=v.resize((each,each),Image.LANCZOS)
    x=gap+i*(each+gap); m.alpha_composite(vr,(x,gap))
    lbl=str(i+1); lw=md.textlength(lbl,font=lf)
    md.text((x+each/2-lw/2, gap+each+6), lbl, font=lf, fill=(30,30,40,255))
m.convert("RGB").save("variants.png"); print("saved variants.png", m.size)
