// Paletas de la app. `Colors` es un objeto MUTABLE: al arrancar, el layout raíz lee
// la preferencia de apariencia (sistema / clara / oscura) y llama a applyTheme()
// ANTES de montar ninguna pantalla. Como las pantallas se cargan después, sus
// StyleSheet.create ya leen la paleta correcta. Cambiar de tema = guardar la
// preferencia y recargar la app (src/theme/appearance.ts).

// Identidad Kuova Health: Deep Green #0E2A24, Gold #C9A36B, Sand #EDE5D9, Cream #FAF8F3,
// Sage y Charcoal #2A2A2A (la misma paleta que la web pública).

// Oscuro "Deep Green": la versión "sobre fondo oscuro" del logo, con el oro como acento.
const DARK = {
  isLight: false,
  background: '#0A1D19',
  backgroundElevated: '#0F2722',
  card: '#12302A',
  cardBorder: '#1E4038',

  textPrimary: '#FAF8F3',
  textSecondary: '#A9B8B1',
  textMuted: '#748A82',

  accent: '#C9A36B',
  accentSoft: 'rgba(201, 163, 107, 0.16)',

  danger: '#E8735C',
  dangerSoft: 'rgba(232, 115, 92, 0.16)',

  warning: '#F0B84D',

  // Estado de marcadores: en rango / a revisar (no reutilizar el acento de marca)
  ok: '#7FC29B',
  attention: '#E8955C',

  tabBarBackground: '#0D241F',
  tabBarBorder: '#1A3A33',
  tabBarActive: '#C9A36B',
  tabBarInactive: '#748A82',

  divider: '#1A3A33',

  pulseAccent: '#E06B9E',
  pinkSoft: '#F7B6D2',
  pinkSoftBg: 'rgba(247, 182, 210, 0.16)',

  // Verde y oro de marca para gráficas, la esfera del check-in y detalles (no son estados)
  green: '#6FBF97',
  gold: '#C9A36B',

  // Series de gráficas y anillos (Today / My Data)
  violet: '#9B8CFF',
  violetSoft: 'rgba(155, 140, 255, 0.15)',
  sky: '#5AB8F0',
  amber: '#F0B84D',
  coral: '#FF8A65',

  // Fondo "nube" de login y pantallas de bienvenida
  cosmicBase: '#0A1D19',
  cosmicBlobs: ['#1E4D41', '#8A6D3F', '#3E6B5C', '#24443B'],
};

// Claro "Cream": crema y arena de fondo, Deep Green como acento y Gold en los detalles.
const LIGHT: typeof DARK = {
  isLight: true,
  background: '#FAF8F3',
  backgroundElevated: '#FFFFFF',
  card: '#FFFFFF',
  cardBorder: '#E5DDD0',

  textPrimary: '#2A2A2A',
  textSecondary: '#66635D',
  textMuted: '#9A958C',

  accent: '#0E2A24',
  accentSoft: 'rgba(14, 42, 36, 0.08)',

  danger: '#B3402F',
  dangerSoft: 'rgba(179, 64, 47, 0.12)',

  warning: '#A8742A',

  // El acento es casi negro-verde: "en rango" en un verde salvia más vivo y "a revisar"
  // en ámbar anaranjado para que no se confundan con él.
  ok: '#3F8A5E',
  attention: '#C9701E',

  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#E5DDD0',
  tabBarActive: '#0E2A24',
  tabBarInactive: '#9A958C',

  divider: '#EDE5D9',

  pulseAccent: '#C2477A',
  pinkSoft: '#D9829F',
  pinkSoftBg: 'rgba(217, 130, 159, 0.16)',

  green: '#2E7D5B',
  gold: '#B8904F',

  violet: '#7A5BB5',
  violetSoft: 'rgba(122, 91, 181, 0.12)',
  sky: '#3E7FA8',
  amber: '#B8904F',
  coral: '#D9663F',

  cosmicBase: '#FAF8F3',
  cosmicBlobs: ['#DDE6DF', '#E9D7B8', '#C7D6CC', '#EDE5D9'],
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
  background: '#0A1D19',
};

// Color con transparencia a partir de un hex (#RRGGBB) de la paleta.
export function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
