import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

// Salir de verdad: cierra la sesión (o sale del portal de demo) y vuelve al inicio. Antes, el botón
// cerraba la sesión pero dejaba al usuario en la pantalla en la que estaba, que se quedaba rota.
// En el portal de demo, "salir" vuelve al selector para entrar como otro usuario.
export function useLogout() {
  const router = useRouter();
  const { logout, demoMode, setDemoMode } = useAuth();
  return () => {
    if (demoMode === 'pro') setDemoMode(null);
    else logout();
    if (router.canDismiss?.()) router.dismissAll();
    router.replace('/');
  };
}
