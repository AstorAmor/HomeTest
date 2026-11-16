import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Pressable, Keyboard, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { t } from '@/i18n';
import { INTER } from '@/theme/fine';

// Hoja centrada para el portal: ficha de un ejercicio o la biblioteca para elegir uno. `footer` queda
// fijo abajo (p. ej. "Añadir 3 ejercicios" al elegir varios). El fondo que cierra va detrás de la
// hoja y no la envuelve: envolver el ScrollView en un Pressable atascaba el deslizar en Android.
// Con el teclado fuera (el buscador de la biblioteca), la hoja encoge hasta encima del teclado: en Android la app va de
// borde a borde y la ventana no encoge sola, así que antes el teclado tapaba los ejercicios. Deslizar la lista lo
// esconde (fundador, 2026-11-06).
export function WorkoutModal({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const up = visible && keyboard > 0;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, up && { justifyContent: 'flex-end', paddingTop: insets.top + 8, paddingBottom: keyboard + 8 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('Close')} />
        <View style={[styles.sheet, up && { maxHeight: Math.max(240, height - keyboard - insets.top - 16) }]}>
          <View style={styles.head}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel={t('Close')}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" nestedScrollEnabled>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 980, maxHeight: '90%', backgroundColor: Colors.background, borderRadius: 18, borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  title: { flex: 1, color: Colors.textPrimary, fontSize: 18, fontFamily: INTER.medium },
  body: { padding: 18 },
  footer: { paddingHorizontal: 18, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.divider },
});
