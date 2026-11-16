import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardEvent, Platform, ScrollView, ScrollViewProps, TextInput, View } from 'react-native';

// ScrollView para pantallas con cuadros de texto (check-in, heces, orina…). En Android, con la app
// de borde a borde, el teclado ya no encoge la ventana: se pone encima y tapa lo que escribes. Aquí,
// al abrirse el teclado, se deja al final un hueco de lo que el teclado tapa de la ScrollView (para poder
// subir el contenido) y se desplaza lo justo para que el cuadro que tiene el foco quede visible.
// Si debajo hay un pie fijo que sube con el teclado (KeyboardFooter), la ScrollView ya se encoge y no
// hace falta hueco: por eso se mide dónde acaba ella, no solo dónde empieza el teclado (2026-11-16).
export const KeyboardAwareScrollView = ({ children, onScroll, ...rest }: ScrollViewProps) => {
  const ref = useRef<ScrollView>(null);
  const offset = useRef(0);
  const [spacer, setSpacer] = useState(0);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    // Sube el contenido para que el cuadro con el foco acabe por encima de `visibleBottom`
    const reveal = (visibleBottom: number) => {
      const input = TextInput.State.currentlyFocusedInput?.() as unknown as View | null;
      if (!input || !ref.current) return;
      input.measureInWindow((_x, y, _w, h) => {
        const overlap = y + h + 24 - visibleBottom;
        if (overlap > 0) ref.current?.scrollTo({ y: offset.current + overlap, animated: true });
      });
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e: KeyboardEvent) => {
      const keyboardTop = e.endCoordinates.screenY;
      clearTimeout(timer);
      // Tras moverse el teclado (y el pie fijo, si lo hay), se mide dónde acaba la ScrollView
      timer = setTimeout(
        () => {
          const sv = ref.current as unknown as View | null;
          if (!sv?.measureInWindow) return;
          sv.measureInWindow((_x, y, _w, h) => {
            const bottom = y + h;
            setSpacer(Math.max(0, bottom - keyboardTop));
            // Tras pintar el hueco, para que haya sitio al que desplazarse
            timer = setTimeout(() => reveal(Math.min(bottom, keyboardTop)), 60);
          });
        },
        ios ? 250 : 120,
      );
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      clearTimeout(timer);
      setSpacer(0);
    });
    return () => {
      clearTimeout(timer);
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      {...rest}
      onScroll={(e) => {
        offset.current = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      }}
    >
      {children}
      {spacer > 0 && <View style={{ height: spacer }} />}
    </ScrollView>
  );
};
