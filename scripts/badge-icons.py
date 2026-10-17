# Saca los contornos de los iconos de Ionicons (los de las insignias) como trazos SVG.
# Uso: python scripts/badge-icons.py <Ionicons.ttf> <Ionicons.json> <salida.ts> nombre1 nombre2 ...
# Ejemplo: python scripts/badge-icons.py node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json src/components/badges/badgeIconPaths.ts footsteps walk trophy barbell happy restaurant leaf
import json, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

ttf, glyphmap, out, *names = sys.argv[1:]
font = TTFont(ttf)
cmap = font.getBestCmap()
gs = font.getGlyphSet()
gmap = json.load(open(glyphmap, encoding='utf-8'))
lines = []
for n in names:
    cp = gmap[n]
    g = cmap[cp]
    pen = SVGPathPen(gs)
    gs[g].draw(pen)
    bp = BoundsPen(gs)
    gs[g].draw(bp)
    x0, y0, x1, y1 = bp.bounds
    lines.append(f"  '{n}': {{ d: '{pen.getCommands()}', box: [{x0}, {y0}, {x1}, {y1}] }},")
upm = font['head'].unitsPerEm
src = (
    "// Generado con scripts/badge-icons.py a partir de Ionicons.ttf (@expo/vector-icons): contornos de los\n"
    "// iconos de las insignias para dibujarlos dentro del SVG que se comparte (una fuente de iconos no sale en la\n"
    f"// imagen). Coordenadas de la fuente (eje Y hacia arriba, {upm} unidades por em); box = [xMin, yMin, xMax, yMax].\n"
    "export const BADGE_ICON_PATHS: Record<string, { d: string; box: [number, number, number, number] }> = {\n"
    + "\n".join(lines) + "\n};\n"
)
open(out, 'w', encoding='utf-8').write(src)
print('ok', len(names), 'upm', upm)
