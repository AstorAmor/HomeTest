import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { expectSystemUi } from './systemUi';

// Elegir una foto de la galería para el fondo de pantalla de la tarjeta: se recorta al centro a la
// medida del fondo (1080 × 2340, como cubrir la pantalla) y se comprime. Devuelve un data URI (lo
// pinta el SVG de la tarjeta, también al pasarlo a PNG) o null si se cancela.
export const WALL_W = 1080;
export const WALL_H = 2340;

export async function pickWallpaperPhoto(): Promise<string | null> {
  // La galería sale encima de la app: que el bloqueo no la tape con la K (src/utils/systemUi.ts)
  expectSystemUi();
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const a = r.canceled ? null : r.assets?.[0];
  if (!a) return null;
  const w = a.width || WALL_W;
  const h = a.height || WALL_H;
  const s = Math.max(WALL_W / w, WALL_H / h); // lo justo para cubrir el fondo entero
  const rw = Math.max(WALL_W, Math.round(w * s));
  const rh = Math.max(WALL_H, Math.round(h * s));
  const out = await manipulateAsync(
    a.uri,
    [{ resize: { width: rw, height: rh } }, { crop: { originX: Math.floor((rw - WALL_W) / 2), originY: Math.floor((rh - WALL_H) / 2), width: WALL_W, height: WALL_H } }],
    { compress: 0.75, format: SaveFormat.JPEG, base64: true },
  );
  return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
}
