import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useNavigation } from 'expo-router';

// Si no llega 'transitionEnd' (p. ej. si la pantalla se abre sin animación), no se espera más que esto
const FALLBACK_MS = 650;

// true en cuanto acaba la animación de entrada de la pantalla. Sirve para pintar primero lo de arriba (lo que se ve
// mientras se desliza) y montar después las listas largas: montarlas durante el deslizamiento es lo que lo hace ir a
// tirones (fundador, 2026-11-18, al abrir el informe desde el rosco de Análisis: «lo hace de forma poco fluida»).
// En web no hay animación: el resto entra en el fotograma siguiente.
export function useAfterTransition() {
  const navigation = useNavigation();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const finish = () => setDone(true);
    if (Platform.OS === 'web') {
      let id = requestAnimationFrame(() => (id = requestAnimationFrame(finish)));
      return () => cancelAnimationFrame(id);
    }
    const timer = setTimeout(finish, FALLBACK_MS);
    const unsubscribe = navigation.addListener('transitionEnd' as any, (e: any) => {
      if (!e?.data?.closing) finish();
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [navigation, done]);

  return done;
}
