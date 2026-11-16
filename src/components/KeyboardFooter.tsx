// Pie de pantalla fijo (el botón «Continuar», «Guardar»…) que sube con el teclado. Con la app de borde a
// borde el teclado ya no encoge la ventana, así que sin esto tapa el botón (fundador, 2026-11-16: Medicación,
// «¿Qué tomas habitualmente?»). Al abrirse el teclado mide dónde queda el pie y lo levanta lo justo para
// que quede encima; al cerrarse vuelve a su sitio. Funciona igual dentro de un SafeAreaView con el borde
// de abajo (ya deja el hueco de la barra) que sin él, porque compara posiciones en la ventana.
// La ScrollView de encima (KeyboardAwareScrollView) se encoge con él y no añade hueco de más.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, LayoutAnimation, Platform, View, type StyleProp, type ViewStyle } from 'react-native';

export function useKeyboardLift(ref: React.RefObject<View | null>): number {
  const [lift, setLift] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const ios = Platform.OS === 'ios';
    const apply = (next: number, duration?: number) => {
      if (Math.abs(next - current.current) < 1) return;
      if (ios) LayoutAnimation.configureNext(LayoutAnimation.create(duration || 250, LayoutAnimation.Types.keyboard, LayoutAnimation.Properties.opacity));
      current.current = next;
      setLift(next);
    };
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      const keyboardTop = e.endCoordinates.screenY;
      ref.current?.measureInWindow((_x, y, _w, h) => {
        // Dónde acaba el pie sin levantar (si ya estaba levantado, se suma lo que subió)
        const restBottom = y + h + current.current;
        apply(Math.max(0, restBottom - keyboardTop), e.duration);
      });
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (e) => apply(0, e?.duration));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [ref]);
  return lift;
}

export function KeyboardFooter({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<View>(null);
  const lift = useKeyboardLift(ref);
  return (
    <View ref={ref} style={[style, lift > 0 && { marginBottom: lift }]}>
      {children}
    </View>
  );
}
