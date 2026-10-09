import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, DevSettings, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { applyTheme, Colors, themeBackground, ThemeName } from '@/constants/colors';
import { fadeBeforeReload } from './transition';

// Preferencia de apariencia: 'system' sigue al móvil; 'light' / 'dark' la fijan.
export type AppearancePref = 'system' | 'light' | 'dark';

const KEY = 'appearance.v1';
const RETURN_KEY = 'appearance.returnTo.v1';

export const resolveTheme = (pref: AppearancePref): ThemeName =>
  pref === 'system' ? (Appearance.getColorScheme() === 'light' ? 'light' : 'dark') : pref;

export async function getAppearancePref(): Promise<AppearancePref> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

// Se llama una vez al arrancar, antes de montar las pantallas.
export async function loadAppearance(): Promise<ThemeName> {
  const theme = resolveTheme(await getAppearancePref());
  applyTheme(theme);
  return theme;
}

// Guarda la preferencia y recarga la app para que todas las pantallas la usen, con un fundido
// al color del tema nuevo (src/theme/transition.tsx). `returnTo` es la ruta a la que volver tras
// recargar (sin perder la sesión). Si el tema que se ve no cambia (p. ej. de Auto a Dark con el
// móvil en oscuro), solo se guarda.
export async function setAppearancePref(pref: AppearancePref, returnTo?: string) {
  await AsyncStorage.setItem(KEY, pref);
  const next = resolveTheme(pref);
  if (next === (Colors.isLight ? 'light' : 'dark')) return;
  await reloadKeepingPlace(themeBackground(next), returnTo);
}

// Recarga la app con el fundido y vuelve a la misma pantalla (también al cambiar de idioma)
export async function reloadKeepingPlace(veilColor: string, returnTo?: string) {
  // En web la recarga ya mantiene la URL; en el móvil se vuelve a la ruta guardada.
  if (returnTo && Platform.OS !== 'web') await AsyncStorage.setItem(RETURN_KEY, returnTo);
  await fadeBeforeReload(veilColor);
  if (Platform.OS === 'web') {
    window.location.reload();
  } else if (__DEV__) {
    DevSettings.reload();
  } else {
    await Updates.reloadAsync();
  }
}

// Ruta pendiente tras un cambio de tema (se consume una sola vez).
export async function takeAppearanceReturnTo(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(RETURN_KEY);
    if (v) await AsyncStorage.removeItem(RETURN_KEY);
    return v;
  } catch {
    return null;
  }
}
