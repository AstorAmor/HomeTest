"""Fondo de la insignia de la Edad KUOVA (src/components/KuovaAgeBadge.tsx): "capas" de marca.
Láminas apiladas cuyo borde sale de un ruido fractal suave, con la meseta de arriba en el centro, donde va el
número. Sin contorno: solo cambios de tono y una sombra difusa. El aro dorado lo pinta la app.
Genera cuatro versiones de 720 px:
  dark_good  (verde)        dark_watch  (ámbar: edad por encima de la real)
  light_good (arena/crema)  light_watch (terracota suave)
Es el mismo algoritmo que la página de bocetos (ronda 3, «Capas, versión sobria»), con la misma semilla.
Uso: python scripts/kuova-age-art.py assets/images/kuova-age"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

M32 = 0xFFFFFFFF


def rng(seed):
    # mulberry32, igual que en la página de bocetos, para que salga la misma forma
    s = seed & M32

    def nxt():
        nonlocal s
        s = (s + 0x6D2B79F5) & M32
        t = s
        t = ((t ^ (t >> 15)) * (t | 1)) & M32
        t = (t ^ ((t + (((t ^ (t >> 7)) * (t | 61)) & M32)) & M32)) & M32
        return ((t ^ (t >> 14)) & M32) / 4294967296

    return nxt


def make_noise(seed):
    r = rng(seed)
    perm = list(range(256))
    for i in range(255, 0, -1):
        j = int(r() * (i + 1))
        perm[i], perm[j] = perm[j], perm[i]
    P = np.array(perm + perm, dtype=np.int64)
    ang = np.array([r() * np.pi * 2 for _ in range(256)])
    G = np.stack([np.cos(ang), np.sin(ang)], axis=1)
    fade = lambda t: t * t * t * (t * (t * 6 - 15) + 10)

    def n(x, y):
        X, Y = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
        xf, yf = x - X, y - Y

        def g(i, j):
            v = G[P[(P[(X + i) & 255] + Y + j) & 255]]
            return v[..., 0] * (xf - i) + v[..., 1] * (yf - j)

        u, w = fade(xf), fade(yf)
        a = g(0, 0) + (g(1, 0) - g(0, 0)) * u
        b = g(0, 1) + (g(1, 1) - g(0, 1)) * u
        return a + (b - a) * w

    def fbm(x, y, octaves):
        s, amp, f, norm = 0.0, 1.0, 1.0, 0.0
        for _ in range(octaves):
            s = s + amp * n(x * f, y * f)
            norm += amp
            amp *= 0.5
            f *= 2
        return s / norm

    return fbm


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def hexrgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float64)


def capas(size, bg, top, shadow, levels=5):
    W = size
    k = W / 196  # los bocetos se dibujaron a 196 px; la sombra escala con el tamaño
    yy, xx = np.mgrid[0:W, 0:W].astype(np.float64)
    s = 1.5 / W
    f = 0.5 + make_noise(21)(xx * s + 4.3, yy * s + 2.1, 2) * 1.1
    base = 1 - smooth(0.32, 1.05, np.hypot(xx - W / 2, yy - W / 2) / (W / 2))
    T = np.clip((0.24 * f + 0.9 * base) * levels, 0, levels - 0.001)
    L = np.floor(T).astype(np.int64)
    fr = T - L
    gx = np.diff(T, axis=1, append=T[:, -1:])
    gy = np.diff(T, axis=0, append=T[-1:, :])
    g = np.maximum(1e-4, np.hypot(gx, gy))
    blend = np.minimum(1, fr / g)
    bg, top = hexrgb(bg), hexrgb(top)
    tone = lambda l: bg + (top - bg) * (np.clip(l, 0, None) / (levels - 1))[..., None] ** 0.9
    c = np.where((L > 0)[..., None], tone(L - 1) + (tone(L) - tone(L - 1)) * blend[..., None], tone(L))
    # Sombra difusa que proyecta cada lámina sobre la de abajo (luz desde arriba a la izquierda)
    S, step = int(round(7 * k)), max(1, int(round(k)))
    sh = np.zeros_like(T)
    for d in range(step, S + 1, step):
        shifted = np.full_like(L, -1)
        shifted[d:, d:] = L[:-d, :-d]
        sh = np.where((shifted > L) & (sh == 0), 1 - d / S, sh)
    c = c * (1 - sh * shadow)[..., None]
    return Image.fromarray(np.clip(c, 0, 255).astype(np.uint8))


VERSIONS = {
    'dark_good': ('#081814', '#1E4D41', 0.32),
    'dark_watch': ('#081814', '#5A4424', 0.32),
    'light_good': ('#E9E1D2', '#FAF8F3', 0.09),
    'light_watch': ('#EBD6C3', '#FBF5EF', 0.09),
}

if __name__ == '__main__':
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    for name, (bg, top, shadow) in VERSIONS.items():
        # Se dibuja al doble y se reduce para suavizar los bordes entre láminas
        capas(1440, bg, top, shadow).resize((720, 720), Image.LANCZOS).save(out / f'{name}.jpg', quality=88, optimize=True)
    # Hoja de contacto para revisar
    sheet = Image.new('RGB', (4 * 360 + 50, 380), (120, 120, 120))
    for i, n in enumerate(VERSIONS):
        tile = Image.open(out / f'{n}.jpg').resize((360, 360))
        mask = Image.new('L', (360, 360), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, 359, 359), fill=255)
        sheet.paste(tile, (10 + i * 370, 10), mask)
    sheet.save(out / 'sheet.png')
    print('ok', [p.stat().st_size // 1024 for p in sorted(out.glob('*.jpg'))])
