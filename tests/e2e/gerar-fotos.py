"""Gera fotos de teste: uma grande com data e GPS no EXIF (como a câmera do celular grava) e uma sem EXIF."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

pasta = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent / "fotos")
pasta.mkdir(parents=True, exist_ok=True)

def lavoura(largura, altura, tom):
    img = Image.new("RGB", (largura, altura), (120, 90, 60))
    d = ImageDraw.Draw(img)
    for i, x in enumerate(range(0, largura, 60)):
        d.rectangle([x, 0, x + 34, altura], fill=(40, 110 + tom + (i % 3) * 15, 50))
    d.rectangle([0, 0, largura, altura // 4], fill=(150, 190, 230))
    return img

def graus(v):
    v = abs(v); g = int(v); m = int((v - g) * 60); s = round(((v - g) * 60 - m) * 60, 2)
    return (float(g), float(m), s)

exif = Image.Exif()
exif[0x8769] = {0x9003: "2026:11:10 09:30:00"}  # DateTimeOriginal
exif[0x8825] = {1: "S", 2: graus(-18.4478), 3: "W", 4: graus(-50.4512)}  # GPS (Quirinópolis)
lavoura(3000, 2000, 0).save(pasta / "v3-com-gps.jpg", "JPEG", quality=85, exif=exif)
lavoura(1200, 900, 40).save(pasta / "r1-sem-exif.jpg", "JPEG", quality=85)
print("fotos geradas em", pasta)
