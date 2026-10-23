import React, { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, TextInput, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps } from 'react-native';

// Un ScrollView en el que el teclado no tapa la casilla en la que se escribe. En Android la app se
// dibuja de borde a borde (Expo 57) y la ventana no encoge al salir el teclado, así que la casilla de
// abajo quedaba debajo. Aquí, con el teclado fuera: se deja hueco debajo del contenido (su alto) y se
// sube lo justo para ver la casilla enfocada. En iOS, igual; en la web el navegador ya la sube y solo se
// centra. Las casillas de dentro avisan al enfocarse con `useRevealOnFocus()` (cambiar de una casilla a
// otra con el teclado ya fuera no da evento de teclado).

const MARGIN = 24; // aire entre la casilla y el teclado

const RevealContext = createContext<() => void>(() => undefined);
export const useRevealOnFocus = () => useContext(RevealContext);

export const KeyboardAwareScroll = forwardRef<ScrollView, ScrollViewProps>(function KeyboardAwareScroll({ contentContainerStyle, onScroll, children, ...rest }, ref) {
  const scroll = useRef<ScrollView>(null);
  useImperativeHandle(ref, () => scroll.current as ScrollView);
  const offsetY = useRef(0);
  const keyboardTop = useRef<number | null>(null); // dónde empieza el teclado en la pantalla
  const [keyboard, setKeyboard] = useState(0);

  const reveal = useCallback(() => {
    if (Platform.OS === 'web') {
      setTimeout(() => (document.activeElement as HTMLElement | null)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 300);
      return;
    }
    const top = keyboardTop.current;
    if (top == null) return; // el teclado aún no ha salido: lo hará keyboardDidShow
    const input = TextInput.State.currentlyFocusedInput() as unknown as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null;
    input?.measureInWindow?.((_x, y, _w, h) => {
      const hidden = y + h + MARGIN - top;
      if (hidden > 0) scroll.current?.scrollTo({ y: offsetY.current + hidden, animated: true });
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      setKeyboard(e.endCoordinates.height);
      // Después de dejar el hueco debajo (si no, no hay sitio al que subir la última casilla)
      setTimeout(reveal, Platform.OS === 'ios' ? 280 : 80);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      keyboardTop.current = null;
      setKeyboard(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [reveal]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetY.current = e.nativeEvent.contentOffset.y;
    onScroll?.(e);
  };

  return (
    <RevealContext.Provider value={reveal}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={32}
        {...rest}
        onScroll={handleScroll}
        contentContainerStyle={[contentContainerStyle, keyboard ? { paddingBottom: keyboard + MARGIN } : null]}
      >
        {children}
      </ScrollView>
    </RevealContext.Provider>
  );
});
