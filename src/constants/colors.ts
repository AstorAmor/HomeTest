// Paletas de la app. `Colors` es un objeto MUTABLE: al arrancar, el layout raíz lee
// la preferencia de apariencia (sistema / clara / oscura) y llama a applyTheme()
// ANTES de montar ninguna pantalla. Como las pantallas se cargan después, sus
// StyleSheet.create ya leen la paleta correcta. Cambiar de tema = guardar la
// preferencia y recargar la app (src/theme/appearance.ts).

const DARK = {
  isLight: false,
  background: '#14161F',
  backgroundElevated: '#1B1E2A',
  card: '#1E2230',
  cardBorder: '#2A2E40',

  textPrimary: '#FFFFFF',
  textSecondary: '#9198AC',
  textMuted: '#6B7185',

  accent: '#3ECDB8',
  accentSoft: 'rgba(62, 205, 184, 0.15)',

  danger: '#E8615C',
  dangerSoft: 'rgba(232, 97, 92, 0.15)',

  warning: '#F0B84D',

  tabBarBackground: '#1A1D2A',
  tabBarBorder: '#262A3A',
  tabBarActive: '#3ECDB8',
  tabBarInactive: '#6B7185',

  divider: '#262A3A',

  pulseAccent: '#E06B9E',
  pinkSoft: '#F7B6D2',
  pinkSoftBg: 'rgba(247, 182, 210, 0.16)',

  // Series de gráficas y anillos (Today / My Data)
  violet: '#9B8CFF',
  violetSoft: 'rgba(155, 140, 255, 0.15)',
  sky: '#5AB8F0',
  amber: '#F0B84D',
  coral: '#FF8A65',

  // Fondo "nube" de login y pantallas de bienvenida
  cosmicBase: '#0D0F1A',
  cosmicBlobs: ['#5B3FD1', '#1C9C95', '#B0437F', '#2B56C9'],
};

// "Terracota": crema cálida, terracota como acento y verde oliva de apoyo.
const LIGHT: typeof DARK = {
  isLight: true,
  background: '#FAF4EC',
  backgroundElevated: '#FFFFFF',
  card: '#FFFFFF',
  cardBorder: '#EADBC8',

  textPrimary: '#2F2420',
  textSecondary: '#806B5E',
  textMuted: '#A8968A',

  accent: '#B5623B',
  accentSoft: 'rgba(181, 98, 59, 0.12)',

  danger: '#C0392B',
  dangerSoft: 'rgba(192, 57, 43, 0.12)',

  warning: '#B7791F',

  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#EADBC8',
  tabBarActive: '#B5623B',
  tabBarInactive: '#A8968A',

  divider: '#EFE3D3',

  pulseAccent: '#C2477A',
  pinkSoft: '#D9829F',
  pinkSoftBg: 'rgba(217, 130, 159, 0.16)',

  violet: '#7A5BB5',
  violetSoft: 'rgba(122, 91, 181, 0.12)',
  sky: '#3E7FA8',
  amber: '#C98A1E',
  coral: '#D9663F',

  cosmicBase: '#FAF4EC',
  cosmicBlobs: ['#E8B69A', '#6F7A4B', '#D9829F', '#C98A1E'],
};

export type ThemeName = 'light' | 'dark';

export const Colors = { ...DARK };

export function applyTheme(theme: ThemeName) {
  Object.assign(Colors, theme === 'light' ? LIGHT : DARK);
}

// Texto sobre fotos y pantallas inmersivas oscuras (igual en los dos temas).
export const OnDark = {
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.72)',
  background: '#0D0F1A',
};

// Color con transparencia a partir de un hex (#RRGGBB) de la paleta.
export function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
