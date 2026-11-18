"""El «00,0» desenfocado de la insignia de la Edad KUOVA sin calcular (KuovaAgeBadge locked), ya
pintado. Antes era un SVG con FeGaussianBlur: en Android ese filtro se calcula por software cada vez
que se pinta la pantalla, y al entrar o volver de la Edad KUOVA se notaba el tirón.

    python scripts/kuova-age-blur.py

Escribe assets/images/kuova-age/blur_{comma,dot}_{dark,light}.png (400 x 400, fondo transparente),
con la misma posición, tamaño y desenfoque que el SVG (viewBox 200: x 100, base 119, letra 54,5,
desviación 4,5; aquí todo × 2).
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent.parent / "assets" / "images" / "kuova-age"
FONT = "C:/Windows/Fonts/segoeuib.ttf"
SCALE = 2
SIZE = 200 * SCALE

COLORS = {"dark": (255, 255, 255), "light": (0x0E, 0x2A, 0x24)}
TEXTS = {"comma": "00,0", "dot": "00.0"}

font = ImageFont.truetype(FONT, int(54.5 * SCALE))
for theme, rgb in COLORS.items():
    for sep, text in TEXTS.items():
        img = Image.new("RGBA", (SIZE, SIZE), (*rgb, 0))
        draw = ImageDraw.Draw(img)
        # anchor "ms": centrado en x, línea base en y (como textAnchor="middle" en SVG)
        draw.text((100 * SCALE, 119 * SCALE), text, font=font, fill=(*rgb, int(255 * 0.85)), anchor="ms")
        img = img.filter(ImageFilter.GaussianBlur(4.5 * SCALE))
        path = OUT / f"blur_{sep}_{theme}.png"
        img.save(path, optimize=True)
        print(path.name, path.stat().st_size, "bytes")


# La cifra fina (desde el 2026-11-18): la Edad KUOVA aún sin calcular en Análisis y en su detalle, como la cifra de
# verdad de KuovaAgeSection (Inter Light 54, alto de línea 60, letra −1) pero desenfocada (fundador: «unos números
# difuminados como: pendiente desbloquear»). Escribe blur_fine_{comma,dot}_{dark,light}.png a ×3, con un margen
# PAD alrededor para que quepa el desenfoque; KuovaAgeLockedFigure lo descuenta con márgenes negativos, así que ocupa
# lo mismo que la cifra. Siempre «00,0»: decorativo, no es la edad de nadie.
FINE_FONT = Path(__file__).resolve().parent.parent / "node_modules/@expo-google-fonts/inter/300Light/Inter_300Light.ttf"
FS, LH, TRACK, PAD, SIGMA, K = 54, 60, -1, 18, 5.2, 3
FINE_COLORS = {"dark": (0xF0, 0xEF, 0xE6), "light": (0x0E, 0x2A, 0x24)}
ffont = ImageFont.truetype(str(FINE_FONT), FS * K)
for sep, text in TEXTS.items():
    advances = [ffont.getlength(ch) + TRACK * K for ch in text]
    tw = sum(advances)
    w, h = round(tw + 2 * PAD * K), (LH + 2 * PAD) * K
    for theme, rgb in FINE_COLORS.items():
        img = Image.new("RGBA", (w, h), (*rgb, 0))
        draw = ImageDraw.Draw(img)
        x = PAD * K
        # anchor "lm": el centro de la x de la letra a media altura de la línea
        for ch, adv in zip(text, advances):
            draw.text((x, (PAD + LH / 2) * K), ch, font=ffont, fill=(*rgb, 255), anchor="lm")
            x += adv
        img = img.filter(ImageFilter.GaussianBlur(SIGMA * K))
        path = OUT / f"blur_fine_{sep}_{theme}.png"
        img.save(path, optimize=True)
        print(path.name, f"{w / K:.1f} x {h / K:.1f} pt", path.stat().st_size, "bytes")
