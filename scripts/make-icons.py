"""Genera los iconos de la app (Kuova Health) a partir del monograma K del logotipo.

    python scripts/make-icons.py

Mismos trazos que la K de components/KuovaLogo.tsx (y del logo de la web), dibujados con
supermuestreo para que los bordes salgan suaves. Escribe en assets/images/.
"""
from pathlib import Path
from PIL import Image, ImageDraw

DEEP_GREEN = (14, 42, 36, 255)
GOLD = (201, 163, 107, 255)
WHITE = (255, 255, 255, 255)
OUT = Path(__file__).resolve().parent.parent / "assets" / "images"
SS = 8  # supermuestreo

# K en coordenadas propias: 260 x 257
K_W, K_H = 260, 257


def _bezier(p0, p1, p2, p3, n=24):
    pts = []
    for i in range(n + 1):
        t = i / n
        a, b, c, d = (1 - t) ** 3, 3 * t * (1 - t) ** 2, 3 * t * t * (1 - t), t ** 3
        pts.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return pts


K_SHAPES = [
    # Asta con el pie en curva + brazo superior + brazo inferior, en un solo contorno
    # (el mismo que KuovaLogo.tsx y la web)
    [(0, 0), (38, 0), (38, 127), (197, 0), (260, 0), (103.67, 115.49), (250, 257), (194, 257),
     (72.58, 138.45), (38, 164), (38, 202)] + _bezier((38, 202), (37, 230), (20, 250), (0, 257))[1:],
]


def draw_k(draw, x, y, height, color):
    s = height / K_H
    for shape in K_SHAPES:
        draw.polygon([(x + px * s, y + py * s) for px, py in shape], fill=color)


def make(size, bg, k_height_ratio, color, rounded=0.0, name=""):
    W, H = size
    big = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    if bg:
        if rounded:
            d.rounded_rectangle([0, 0, W * SS - 1, H * SS - 1], radius=rounded * W * SS, fill=bg)
        else:
            d.rectangle([0, 0, W * SS, H * SS], fill=bg)
    if k_height_ratio:
        kh = H * SS * k_height_ratio
        kw = kh * K_W / K_H
        # Centrado óptico: la K pesa a la izquierda, se desplaza un poco a la derecha
        draw_k(d, (W * SS - kw) / 2 + (kw * 0.02 if k_height_ratio < 1 else 0), (H * SS - kh) / 2, kh, color)
    img = big.resize((W, H), Image.LANCZOS)
    img.save(OUT / name)
    print("ok", name, size)


# Oro metalizado de la imagen de marca (05 Marca\Branding.png): champán arriba a la izquierda, bronce abajo
# a la derecha. Las mismas paradas que la K de src/components/LaunchIntro.tsx (la entrada animada que
# sigue a esta pantalla), para que el paso de una a otra no se note.
GOLD_STOPS = [(0.0, (246, 230, 195)), (0.32, (221, 189, 134)), (0.58, (201, 163, 102)),
              (0.8, (169, 130, 75)), (1.0, (126, 94, 51))]


def _gold_at(t):
    for (t0, c0), (t1, c1) in zip(GOLD_STOPS, GOLD_STOPS[1:]):
        if t <= t1:
            f = (t - t0) / (t1 - t0) if t1 > t0 else 0
            return tuple(round(a + (b - a) * f) for a, b in zip(c0, c1))
    return GOLD_STOPS[-1][1]


def make_gold_splash(name="splash-icon.png"):
    """La K de la pantalla de carga nativa (expo-splash-screen en app.json) con el degradado dorado."""
    W, H = K_W, K_H
    big = Image.new("L", (W * SS, H * SS), 0)
    draw_k(ImageDraw.Draw(big), 0, 0, H * SS, 255)
    mask = big.resize((W, H), Image.LANCZOS)
    grad = Image.new("RGBA", (W, H))
    px = grad.load()
    for y in range(H):
        for x in range(W):
            px[x, y] = _gold_at((x / (W - 1) + y / (H - 1)) / 2) + (255,)
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.paste(grad, (0, 0), mask)
    out.save(OUT / name)
    print("ok", name, (W, H))


import sys

# python scripts/make-icons.py          → iconos de «Kuova» (y los de «Kuova Pruebas»)
# python scripts/make-icons.py pruebas  → solo los de «Kuova Pruebas» (no toca los de arriba)
# python scripts/make-icons.py splash   → solo la K dorada de la pantalla de carga
MODE = sys.argv[1] if len(sys.argv) > 1 else ""
if MODE == "splash":
    make_gold_splash()
    sys.exit(0)
if MODE != "pruebas":
    make((1024, 1024), DEEP_GREEN, 0.46, GOLD, name="icon.png")
    make((512, 512), None, 0.36, GOLD, name="android-icon-foreground.png")
    make((512, 512), DEEP_GREEN, 0, None, name="android-icon-background.png")
    make((432, 432), None, 0.36, WHITE, name="android-icon-monochrome.png")
    make_gold_splash()
    make((48, 48), DEEP_GREEN, 0.56, GOLD, rounded=0.22, name="favicon.png")


# ---------------------------------------------------------------------------------------------
# Iconos de «Kuova Pruebas» (APP_VARIANT=staging, ver app.config.js): fondo naranja, K blanca y
# «PRUEBAS» debajo, para no confundirla nunca con «Kuova» en el móvil. Escribe en assets/images/pruebas/.
ORANGE = (214, 98, 30, 255)
STAGING_OUT = OUT / "pruebas"


def make_staging(size, bg, k_ratio, color, label_ratio, name, k_shift=0.07):
    from PIL import ImageFont

    W, H = size
    big = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    if bg:
        d.rectangle([0, 0, W * SS, H * SS], fill=bg)
    kh = H * SS * k_ratio
    kw = kh * K_W / K_H
    draw_k(d, (W * SS - kw) / 2 + kw * 0.02, (H * SS - kh) / 2 - H * SS * k_shift, kh, color)
    if label_ratio:
        font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", int(H * SS * label_ratio))
        text = "PRUEBAS"
        box = d.textbbox((0, 0), text, font=font)
        tw = box[2] - box[0]
        ty = (H * SS + kh) / 2 - H * SS * k_shift + H * SS * 0.035
        d.text(((W * SS - tw) / 2 - box[0], ty - box[1]), text, font=font, fill=color)
    STAGING_OUT.mkdir(exist_ok=True)
    big.resize((W, H), Image.LANCZOS).save(STAGING_OUT / name)
    print("ok", "pruebas/" + name, size)


make_staging((1024, 1024), ORANGE, 0.40, WHITE, 0.105, "icon.png")
make_staging((512, 512), None, 0.30, WHITE, 0.075, "android-icon-foreground.png", k_shift=0.05)
make_staging((512, 512), ORANGE, 0, None, 0, "android-icon-background.png")
make_staging((432, 432), None, 0.30, WHITE, 0.075, "android-icon-monochrome.png", k_shift=0.05)
