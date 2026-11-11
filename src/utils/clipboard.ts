import { Platform, TurboModuleRegistry } from 'react-native';

// Leer lo copiado sin añadir una librería nativa (2026-11-11, casillas del código de 6 cifras): React Native
// 0.86 aún trae su módulo «Clipboard» (obsoleto, pero dentro del APK y de la app de iPhone), así que funciona
// con una actualización OTA. Se pide con get (no getEnforcing): si algún día falta, no hay botón y ya está.
// En la web, navigator.clipboard (el navegador pide permiso; Firefox no lo tiene).
// Cuando se pase a expo-clipboard (lote nativo), solo cambia este archivo.

type ClipboardModule = { getString: () => Promise<string> };

let native: ClipboardModule | null | undefined;
const nativeClipboard = (): ClipboardModule | null => {
  if (native === undefined) {
    try {
      native = (TurboModuleRegistry.get('Clipboard') as unknown as ClipboardModule | null) ?? null;
    } catch {
      native = null;
    }
  }
  return native;
};

export const canReadClipboard = (): boolean =>
  Platform.OS === 'web'
    ? typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function'
    : nativeClipboard() !== null;

// Texto copiado, o '' si no hay, no se puede leer o no hay permiso
export async function readClipboard(): Promise<string> {
  try {
    if (Platform.OS === 'web') return (await navigator.clipboard.readText()) ?? '';
    return (await nativeClipboard()?.getString()) ?? '';
  } catch {
    return '';
  }
}
