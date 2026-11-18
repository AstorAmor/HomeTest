import { Platform, TurboModuleRegistry } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

// Leer lo copiado (2026-11-11, casillas del código de 6 cifras):
// - Con expo-clipboard (APK y app de iPhone desde el 2026-11-11): se puede mirar antes si hay texto copiado sin
//   leerlo (hasStringAsync), así Android no avisa de «Kuova ha pegado…» cuando no hay nada.
// - Sin él (APK anteriores, que reciben esto por OTA): el módulo «Clipboard» que React Native 0.86 aún trae
//   (obsoleto, pero dentro de la app). Se pide con get (no getEnforcing): si algún día falta, no hay botón.
// - En la web, navigator.clipboard (el navegador pide permiso; Firefox no lo tiene).

type ExpoClipboard = { getStringAsync: () => Promise<string>; hasStringAsync: () => Promise<boolean> };
type CoreClipboard = { getString: () => Promise<string> };

let expoMod: ExpoClipboard | null | undefined;
const expoClipboard = (): ExpoClipboard | null => {
  if (expoMod !== undefined) return expoMod;
  expoMod = null;
  if (Platform.OS === 'web' || !requireOptionalNativeModule('ExpoClipboard')) return expoMod;
  try {
    expoMod = require('expo-clipboard') as ExpoClipboard;
  } catch {
    expoMod = null;
  }
  return expoMod;
};

let core: CoreClipboard | null | undefined;
const coreClipboard = (): CoreClipboard | null => {
  if (core === undefined) {
    try {
      core = (TurboModuleRegistry.get('Clipboard') as unknown as CoreClipboard | null) ?? null;
    } catch {
      core = null;
    }
  }
  return core;
};

export const canReadClipboard = (): boolean =>
  Platform.OS === 'web'
    ? typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function'
    : expoClipboard() !== null || coreClipboard() !== null;

// ¿Hay texto copiado? Sin leerlo (no salta el aviso de Android). Si no se puede saber, true.
export async function hasClipboardText(): Promise<boolean> {
  try {
    const m = expoClipboard();
    return m ? await m.hasStringAsync() : true;
  } catch {
    return true;
  }
}

// Texto copiado, o '' si no hay, no se puede leer o no hay permiso
export async function readClipboard(): Promise<string> {
  try {
    if (Platform.OS === 'web') return (await navigator.clipboard.readText()) ?? '';
    const m = expoClipboard();
    if (m) return (await m.getStringAsync()) ?? '';
    return (await coreClipboard()?.getString()) ?? '';
  } catch {
    return '';
  }
}
