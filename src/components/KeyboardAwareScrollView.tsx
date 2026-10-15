import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardEvent, Platform, ScrollView, ScrollViewProps, TextInput, View } from 'react-native';

// ScrollView para pantallas con cuadros de texto (check-in, heces, orina…). En Android, con la app
// de borde a borde, el teclado ya no encoge la ventana: se pone encima y tapa lo que escribes. Aquí,
// al abrirse el teclado, se deja al final un hueco de su altura (para poder subir el contenido) y se
// desplaza lo justo para que el cuadro que tiene el foco quede visible encima del teclado.
export const KeyboardAwareScrollView = ({ children, onScroll, ...rest }: ScrollViewProps) => {
  const ref = useRef<ScrollView>(null);
  const offset = useRef(0);
  const [spacer, setSpacer] = useState(0);

  useEffect(() => {
    const reveal = (e: KeyboardEvent) => {
      const input = TextInput.State.currentlyFocusedInput?.() as unknown as View | null;
      if (!input || !ref.current) return;
      const keyboardTop = e.endCoordinates.screenY;
      input.measureInWindow((_x, y, _w, h) => {
        const overlap = y + h + 24 - keyboardTop;
        if (overlap > 0) ref.current?.scrollTo({ y: offset.current + overlap, animated: true });
      });
    };
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      setSpacer(e.endCoordinates.height);
      // Tras pintar el hueco, para que haya sitio al que desplazarse
      setTimeout(() => reveal(e), Platform.OS === 'ios' ? 250 : 80);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setSpacer(0));
    return () => {
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
