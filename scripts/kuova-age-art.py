"""Versiones de la foto del corazón para la insignia de la Edad KUOVA (src/components/KuovaAgeBadge.tsx).
Recorta el interior del aro (el aro lo pinta la app), reduce a 720 px y genera:
  dark_good  (original, dorado)        dark_watch (ámbar/rojizo: edad por encima de la real)
  light_good (corazón verde sobre claro) light_watch (corazón terracota sobre claro)
Original: assets/images/kuova-age/original.webp (la eligió el fundador).
Uso: python scripts/kuova-age-art.py assets/images/kuova-age/original.webp assets/images/kuova-age"""
import sys, colorsys
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
im = Image.open(src).convert('RGB')
c, r = 1000, 792
im = im.crop((c - r, c - r, c + r, c + r)).resize((720, 720), Image.LANCZOS)
a = np.asarray(im).astype(np.float32) / 255.0

def save(arr, name):
    Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)).save(out / f'{name}.jpg', quality=86, optimize=True)

save(a, 'dark_good')

# Ámbar/rojizo: gira el tono de los dorados hacia el naranja-rojo
hsv = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).convert('HSV')).astype(np.float32)
h = hsv[..., 0]
warm = (h > 10) & (h < 60)  # dorados (escala 0-255)
hsv[..., 0] = np.where(warm, h - 18, h) % 255
hsv[..., 1] = np.where(warm, np.minimum(255, hsv[..., 1] * 1.15), hsv[..., 1])
watch = np.asarray(Image.fromarray(hsv.astype(np.uint8), 'HSV').convert('RGB')).astype(np.float32) / 255.0
save(watch, 'dark_watch')

# Versión clara: lo luminoso (corazón, destellos) en color sobre el fondo claro de la app
lum = (0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2])
t = np.clip((lum - 0.06) / 0.75, 0, 1) ** 0.85
bg = np.array([0.965, 0.953, 0.925])  # crema claro
def light(main, high):
    main, high = np.array(main), np.array(high)
    col = main[None, None, :] * (1 - t[..., None] ** 2) + high[None, None, :] * (t[..., None] ** 2)
    return bg * (1 - t[..., None] * 0.85) + col * (t[..., None] * 0.85)
save(light([0.18, 0.42, 0.34], [0.55, 0.66, 0.45]), 'light_good')
save(light([0.62, 0.36, 0.20], [0.80, 0.60, 0.35]), 'light_watch')

# Hoja de contacto para revisar
sheet = Image.new('RGB', (4 * 360 + 50, 380), (120, 120, 120))
for i, n in enumerate(['dark_good', 'dark_watch', 'light_good', 'light_watch']):
    tile = Image.open(out / f'{n}.jpg').resize((360, 360))
    mask = Image.new('L', (360, 360), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, 359, 359), fill=255)
    sheet.paste(tile, (10 + i * 370, 10), mask)
sheet.save(out / 'sheet.png')
print('ok', [p.stat().st_size // 1024 for p in sorted(out.glob('*.jpg'))])
