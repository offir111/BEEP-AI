from PIL import Image
m = Image.open(r"C:\Users\Admin\Desktop\beep-ai\public\beep-ai-logo.png").convert("RGBA")
RES = r"C:\Users\Admin\Desktop\beep-ai\android\app\src\main\res"
legacy = {"mdpi":48,"hdpi":72,"xhdpi":96,"xxhdpi":144,"xxxhdpi":192}
fg     = {"mdpi":108,"hdpi":162,"xhdpi":216,"xxhdpi":324,"xxxhdpi":432}
for dens,sz in legacy.items():
    im=m.resize((sz,sz),Image.LANCZOS)
    im.save(f"{RES}\mipmap-{dens}\ic_launcher.png")
    im.save(f"{RES}\mipmap-{dens}\ic_launcher_round.png")
for dens,sz in fg.items():
    m.resize((sz,sz),Image.LANCZOS).save(f"{RES}\mipmap-{dens}\ic_launcher_foreground.png")
# PWA
m.resize((192,192),Image.LANCZOS).save(r"C:\Users\Admin\Desktop\beep-ai\public\icon-192.png")
m.resize((512,512),Image.LANCZOS).save(r"C:\Users\Admin\Desktop\beep-ai\public\icon-512.png")
print("icons generated")
