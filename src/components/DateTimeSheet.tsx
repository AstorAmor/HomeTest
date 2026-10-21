import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { t } from '@/i18n';

// Selector de fecha u hora de los registros. En Android es el diálogo del sistema, que se cierra solo
// al elegir (la pantalla pone `mode` a null en su onChange). En iOS la rueda no trae botón de cerrar:
// va en una hoja abajo con «Hecho», y cada giro ya cambia el valor.
export const DateTimeSheet = ({
  mode,
  value,
  onChange,
  onClose,
}: {
  mode: 'date' | 'time' | null;
  value: Date;
  onChange: (event: DateTimePickerEvent, selected?: Date) => void;
  onClose: () => void;
}) => {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== 'ios') {
    return mode ? <DateTimePicker value={value} mode={mode} display="default" onChange={onChange} /> : null;
  }
  return (
    <Modal visible={!!mode} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]} onPress={() => undefined}>
          <View style={styles.head}>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={styles.done}>{t('Done')}</Text>
            </TouchableOpacity>
          </View>
          {mode && (
            <DateTimePicker
              value={value}
              mode={mode}
              display="spinner"
              onChange={onChange}
              themeVariant={Colors.isLight ? 'light' : 'dark'}
              textColor={Colors.textPrimary}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  head: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  done: { color: Colors.accent, fontSize: 16, fontWeight: '800' },
});
