// Hoja de abajo para cambiar un dato de «Sobre ti» en Mi perfil (fundador, 2026-11-16: cada dato se cambia con un
// toque, sin pasar por la pantalla de editar). Se ve como la hoja de un día de las metas (MetaParts, `DaySheet`):
// fondo esmeralda oscuro, esquinas redondas arriba y una línea fina encima; tocar fuera o «atrás» la cierra.
// No es un Modal: va por encima de la pantalla, dentro de ella. Así el teclado (la medicación, «Otra» enfermedad)
// avisa como en cualquier pantalla y la hoja sube con él (useKeyboardLift, el de KeyboardFooter); en un Modal de
// Android, con la app de borde a borde, el teclado podría tapar el cuadro de texto. Si no cabe, la lista de en
// medio se encoge y se desplaza; el título y el pie (cuadro de texto y «Guardar») siempre se ven.
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, BackHandler, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardLift } from '@/components/KeyboardFooter';
import { FINE, ff } from '@/theme/fine';

export function FieldSheet({
  title,
  sub,
  children,
  footer,
  scroll = true,
  onClose,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  footer?: ReactNode; // fuera de la parte que se desplaza: encima del teclado
  scroll?: boolean; // false con ruedas dentro (no se pelean dos desplazamientos)
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const ref = useRef<View>(null);
  const lift = useKeyboardLift(ref);
  const shown = useRef(new Animated.Value(0)).current;
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    Animated.timing(shown, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [shown]);

  // «Atrás» en Android cierra la hoja, no la pantalla
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap, { paddingTop: insets.top + 24 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: shown }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close.current()} accessible={false} importantForAccessibility="no" />
      </Animated.View>
      <View ref={ref} style={[styles.holder, lift > 0 && { marginBottom: lift }]}>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { paddingBottom: lift > 0 ? 16 : insets.bottom + 24 },
            { transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [360, 0] }) }] },
          ]}
        >
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {sub ? <Text style={styles.sub}>{sub}</Text> : null}
          {scroll ? (
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
              {children}
            </ScrollView>
          ) : (
            <View style={styles.bodyFixed}>{children}</View>
          )}
          {footer}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'flex-end', zIndex: 20 },
  backdrop: { backgroundColor: 'rgba(2,10,8,0.6)' },
  holder: { flexShrink: 1 },
  sheet: {
    flexShrink: 1,
    backgroundColor: '#0A231D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(240,239,230,0.14)',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: { ...ff('medium'), color: FINE.ivory, fontSize: 19, lineHeight: 24 },
  sub: { ...ff('regular'), color: FINE.mute, fontSize: 14, lineHeight: 20, marginTop: 6 },
  body: { flexGrow: 0, flexShrink: 1, marginTop: 8 },
  bodyFixed: { marginTop: 8 },
});
