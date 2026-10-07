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


make((1024, 1024), DEEP_GREEN, 0.46, GOLD, name="icon.png")
make((512, 512), None, 0.36, GOLD, name="android-icon-foreground.png")
make((512, 512), DEEP_GREEN, 0, None, name="android-icon-background.png")
make((432, 432), None, 0.36, WHITE, name="android-icon-monochrome.png")
make((260, 257), None, 1.0, GOLD, name="splash-icon.png")
make((48, 48), DEEP_GREEN, 0.56, GOLD, rounded=0.22, name="favicon.png")
