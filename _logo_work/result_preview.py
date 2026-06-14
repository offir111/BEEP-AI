from PIL import Image, ImageDraw, ImageFont
logo=Image.open(r"C:\Users\Admin\Desktop\beep-ai\public\beep-ai-logo.png").convert("RGBA")

W,H=820,520
cv=Image.new("RGB",(W,H),(235,236,240)); d=ImageDraw.Draw(cv)
f=ImageFont.truetype("Rubik.ttf",20)
fs=ImageFont.truetype("Rubik.ttf",15)

# 1) header bar
d.text((30,20),"כותרת האפליקציה:",font=f,fill=(20,20,30)); 
bar=Image.new("RGBA",(760,80),(18,18,26,255)); bd=ImageDraw.Draw(bar)
ls=68; l=logo.resize((ls,ls),Image.LANCZOS); bar.alpha_composite(l,(14,6))
bd.text((690,34),"08:08",font=fs,fill=(150,150,160,255))
cv.paste(bar,(30,52))

# 2) home-screen icons (masks)
d.text((30,170),"אייקון על מסך הבית:",font=f,fill=(20,20,30))
def mask_circle(img,size):
    im=img.resize((size,size),Image.LANCZOS)
    m=Image.new("L",(size,size),0); ImageDraw.Draw(m).ellipse([0,0,size,size],fill=255)
    out=Image.new("RGBA",(size,size),(0,0,0,0)); out.paste(im,(0,0),m); return out
def mask_squircle(img,size):
    im=img.resize((size,size),Image.LANCZOS)
    bg=Image.new("RGBA",(size,size),(0,0,0,255))  # black bg fills squircle
    bg.alpha_composite(im)
    m=Image.new("L",(size,size),0); ImageDraw.Draw(m).rounded_rectangle([0,0,size,size],radius=int(size*0.24),fill=255)
    out=Image.new("RGBA",(size,size),(0,0,0,0)); out.paste(bg,(0,0),m); return out
ic1=mask_circle(logo,150); ic2=mask_squircle(logo,150)
# place on a green-ish "wallpaper" patch like the phone
wp=Image.new("RGB",(360,230),(46,160,60)); cv.paste(wp,(30,205))
wp2=Image.new("RGB",(360,230),(46,160,60)); cv.paste(wp2,(420,205))
cv.paste(ic1,(120,240),ic1); d.text((95,400),"מסכה עגולה",font=fs,fill=(255,255,255))
cv.paste(ic2,(510,240),ic2); d.text((470,400),"מסכה מרובעת-מעוגלת",font=fs,fill=(255,255,255))

cv.save("result_preview.png"); print("ok")
