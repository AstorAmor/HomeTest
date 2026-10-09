import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet } from 'react-native';

// Tamaño de letra de la app (Settings). Como el tema, se aplica al arrancar: antes de cargar las
// pantallas se envuelve StyleSheet.create para escalar fontSize y lineHeight. Cambiarlo recarga
// la app con el fundido (reloadKeepingPlace).

export type TextSize = 'small' | 'default' | 'large' | 'xlarge';
export const TEXT_SIZES: { id: TextSize; label: string; scale: number }[] = [
  { id: 'small', label: 'Small', scale: 0.92 },
  { id: 'default', label: 'Default', scale: 1 },
  { id: 'large', label: 'Large', scale: 1.12 },
  { id: 'xlarge', label: 'Extra large', scale: 1.25 },
];

const KEY = 'textSize.v1';

export async function getTextSize(): Promise<TextSize> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return TEXT_SIZES.some((s) => s.id === v) ? (v as TextSize) : 'default';
  } catch {
    return 'default';
  }
}

export const saveTextSize = (size: TextSize) => AsyncStorage.setItem(KEY, size);

export async function loadTextSize() {
  const size = await getTextSize();
  const scale = TEXT_SIZES.find((s) => s.id === size)?.scale ?? 1;
  if (scale === 1) return;
  const create = StyleSheet.create;
  StyleSheet.create = ((styles: Record<string, any>) => {
    const out: Record<string, any> = {};
    for (const [name, style] of Object.entries(styles)) {
      if (style && typeof style === 'object') {
        const s = { ...style };
        if (typeof s.fontSize === 'number') s.fontSize = Math.round(s.fontSize * scale * 2) / 2;
        if (typeof s.lineHeight === 'number') s.lineHeight = Math.round(s.lineHeight * scale);
        out[name] = s;
      } else out[name] = style;
    }
    return create(out);
  }) as typeof StyleSheet.create;
}
