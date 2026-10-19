"""Fotos de los platos para la app: de los JPG generados (05 Marca\\Contenido IA\\2026-10\\recetas, con su
prompts.json) a WebP de 640×480 en assets/images/recipes, y el índice src/data/diet/recipePhotos.ts.
Las fotos se generaron con fal (FLUX.2 Pro, 1024×768, una variación por plato) con el estilo «foto de móvil
realista, plato blanco, mesa de madera limpia, luz de ventana» que eligió el fundador el 2026-10-19.
Uso: python scripts/recipe-photos.py <carpeta con los JPG>"""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'images' / 'recipes'
INDEX = ROOT / 'src' / 'data' / 'diet' / 'recipePhotos.ts'


def main():
    src = Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    ids = []
    total = 0
    for f in sorted(src.glob('*.jpg')):
        im = Image.open(f).convert('RGB').resize((640, 480), Image.LANCZOS)
        dest = OUT / f'{f.stem}.webp'
        im.save(dest, 'WEBP', quality=72, method=6)
        total += dest.stat().st_size
        ids.append(f.stem)
    lines = [
        '// GENERADO por scripts/recipe-photos.py: una foto por receta (fal, FLUX.2 Pro; estilo realista elegido el',
        '// 2026-10-19). Originales y prompts en OneDrive, 05 Marca\\Contenido IA\\2026-10\\recetas.',
        'export const RECIPE_PHOTO_FILES: Record<string, number> = {',
    ]
    lines += [f"  {i}: require('../../../assets/images/recipes/{i}.webp')," for i in ids]
    lines.append('};')
    INDEX.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'{len(ids)} fotos, {total / 1024 / 1024:.1f} MB en total')


if __name__ == '__main__':
    main()
