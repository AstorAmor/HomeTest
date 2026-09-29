import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, DevSettings, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { applyTheme, ThemeName } from '@/constants/colors';

// Preferencia de apariencia: 'system' sigue al móvil; 'light' / 'dark' la fijan.
export type AppearancePref = 'system' | 'light' | 'dark';

const KEY = 'appearance.v1';

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

// Guarda la preferencia y recarga la app para que todas las pantallas la usen.
export async function setAppearancePref(pref: AppearancePref) {
  await AsyncStorage.setItem(KEY, pref);
  if (Platform.OS === 'web') {
    window.location.reload();
  } else if (__DEV__) {
    DevSettings.reload();
  } else {
    await Updates.reloadAsync();
  }
}
