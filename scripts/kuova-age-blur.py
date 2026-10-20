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
