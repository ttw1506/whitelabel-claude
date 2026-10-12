"""Fotos de EXEMPLO para a demonstração (desenhadas, não são fotos reais). Uso: python3 gerar-fotos-demo.py pasta"""
import sys, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

pasta = Path(sys.argv[1]); pasta.mkdir(parents=True, exist_ok=True)
def _fonte(tam):
    for caminho in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"):
        try: return ImageFont.truetype(caminho, tam)
        except OSError: pass
    return ImageFont.load_default(size=tam)
fonte, pequena = _fonte(44), _fonte(26)

def cena(nome, estagio, altura_planta, verde, solo, seed, legenda):
    random.seed(seed)
    L, A = 1600, 1200
    img = Image.new("RGB", (L, A), (157, 196, 232))
    d = ImageDraw.Draw(img)
    for y in range(0, 420):  # céu com gradiente leve
        t = y / 420
        d.line([(0, y), (L, y)], fill=(int(157 + 60 * t), int(196 + 35 * t), int(232 + 15 * t)))
    d.polygon([(0, 420), (L, 380), (L, 460), (0, 500)], fill=(86, 128, 74))  # linha de mata ao fundo
    d.rectangle([0, 450, L, A], fill=solo)
    for linha in range(14):  # linhas de plantio em perspectiva
        y = 470 + int((linha ** 1.7) * 14)
        if y > A: break
        esc = 0.25 + linha * 0.09
        for x in range(-40, L + 40, int(30 + 60 * esc)):
            xx = x + random.randint(-6, 6)
            h = int(altura_planta * esc * random.uniform(0.8, 1.2))
            d.line([(xx, y), (xx, y - h)], fill=verde, width=max(2, int(4 * esc)))
            for k in range(3 if altura_planta > 20 else 2):
                dx = int((10 + 14 * k) * esc)
                yy = y - int(h * (0.35 + 0.22 * k))
                d.ellipse([xx - dx - int(9 * esc), yy - int(5 * esc), xx - dx + int(9 * esc), yy + int(5 * esc)], fill=verde)
                d.ellipse([xx + dx - int(9 * esc), yy - int(5 * esc), xx + dx + int(9 * esc), yy + int(5 * esc)], fill=verde)
    d.rectangle([0, 0, 640, 110], fill=(0, 0, 0))
    d.text((24, 12), f"{estagio}", fill="white", font=fonte)
    d.text((24, 66), "imagem de exemplo", fill=(220, 220, 220), font=pequena)
    d.text((24, A - 50), legenda, fill=(255, 255, 255), font=pequena)
    img.save(pasta / f"{nome}.jpg", "JPEG", quality=84)

SOLO = (112, 76, 52)
cena("soja-ve", "VE", 10, (92, 170, 78), SOLO, 1, "Soja · emergência")
cena("soja-v1", "V1", 20, (70, 160, 70), SOLO, 2, "Soja · primeira folha trifoliolada")
cena("soja-v3", "V3", 36, (52, 148, 62), SOLO, 3, "Soja · terceiro trifólio")
cena("soja-r1", "R1", 70, (40, 130, 52), (96, 70, 50), 4, "Soja · início do florescimento")
cena("soja-r5", "R5", 90, (46, 120, 46), (96, 70, 50), 5, "Soja · enchimento de grãos")
cena("soja-r8", "R8", 80, (176, 150, 70), (96, 70, 50), 6, "Soja · maturação plena")
cena("milho-v4", "V4", 40, (80, 165, 70), SOLO, 7, "Milho · quatro folhas")
cena("milho-v6", "V6", 66, (60, 152, 60), SOLO, 8, "Milho · seis folhas")
print("ok", len(list(pasta.glob("*.jpg"))))
