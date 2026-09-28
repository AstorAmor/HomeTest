import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// Redimensiona y comprime una foto para que el payload sea manejable (varias
// páginas/fotos en una sola llamada pueden pesar mucho si no se comprimen antes).
// maxWidth por defecto pensado para texto pequeño (analíticas); para pantallas
// LCD de pocos dígitos grandes (tensiómetro, glucómetro) basta con menos.
export async function prepareImage(
  uri: string,
  maxWidth: number = 1600
): Promise<{ uri: string; base64: string }> {
  const result = await manipulateAsync(uri, [{ resize: { width: maxWidth } }], {
    compress: 0.6,
    format: SaveFormat.JPEG,
    base64: true,
  });
  return { uri: result.uri, base64: result.base64 ?? '' };
}

// Foto para guardar (comidas): 1080 px de ancho y JPEG al 55 % ≈ 100-200 KB,
// frente a los 3-5 MB de una foto de móvil. Con 1 GB gratis caben miles.
export async function compressPhoto(uri: string, maxWidth: number = 1080): Promise<string> {
  const result = await manipulateAsync(uri, [{ resize: { width: maxWidth } }], {
    compress: 0.55,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
