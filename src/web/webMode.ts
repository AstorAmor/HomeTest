import { Platform, useWindowDimensions } from 'react-native';

// Web del paciente ("Mi perfil"): en un ordenador, menú en una columna a la izquierda y
// contenido en bloques, en lugar de las pestañas de abajo de la app. Se activa con
// EXPO_PUBLIC_WEB_SHELL=1 (la web publicada como perfil) o abriendo cualquier web de la app
// con ?web=1 (se recuerda en ese navegador; ?web=0 vuelve a la vista de app).
const KEY = 'kuova.web';

function readFlag(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  if (process.env.EXPO_PUBLIC_WEB_SHELL === '1') return true;
  try {
    const q = new URLSearchParams(window.location.search).get('web');
    if (q === '1') localStorage.setItem(KEY, '1');
    if (q === '0') localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export const WEB_SHELL_ON = readFlag();

// Por debajo de este ancho (móvil, ventana estrecha) se usa la vista de app de siempre
export const WEB_SHELL_MIN_WIDTH = 900;

export function useWebShell(): boolean {
  const { width } = useWindowDimensions();
  return WEB_SHELL_ON && width >= WEB_SHELL_MIN_WIDTH;
}
