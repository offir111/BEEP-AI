from PIL import Image, ImageDraw

# key bird (upscale then flood-fill white bg)
base=Image.open(r"C:\Users\Admin\Desktop\beep-ai\public\roadrunner-logo.png").convert("RGB")
BW=560; BH=int(BW*base.height/base.width)
big=base.resize((BW,BH),Image.LANCZOS)
SENT=(255,0,255)
for c in [(0,0),(BW-1,0),(0,BH-1),(BW-1,BH-1)]:
    ImageDraw.floodfill(big,c,SENT,thresh=60)
bird=big.convert("RGBA"); bp=bird.load()
for y in range(BH):
    for x in range(BW):
        if bird.getpixel((x,y))[:3]==SENT: bp[x,y]=(0,0,0,0)

# canvas transparent, landscape: squares left, bird right
W,H = 920, 460
cv=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(cv)
CY=(0,229,255,255); BL=(41,98,255,255); OR=(255,122,0,255)
# sparse squares (variant 2) trailing left/behind, scaled up to canvas
for x,y,s,col in [
 (70,150,40,CY),(150,250,34,OR),(210,180,26,BL),(120,300,22,CY),(40,210,30,OR),
 (180,330,18,CY),(250,250,16,BL)]:
    d.rectangle([x,y,x+s,y+s],fill=col)
# bird on right
cv.alpha_composite(bird,(W-BW-20, (H-BH)//2))
cv.save(r"C:\Users\Admin\Desktop\beep-ai\public\beep-ai-bird.png")
# preview on black to simulate header
pv=Image.new("RGBA",(W,H),(0,0,0,255)); pv.alpha_composite(cv); pv.convert("RGB").save("header_bird_preview.png")
print("saved beep-ai-bird.png", cv.size)
