// La barra de arriba de los cuestionarios paso a paso, en el lenguaje fino (src/theme/fine.ts). El fundador,
// 2026-11-17, del cuestionario del ciclo: «no está coherente la barra de progreso y la fuente e iconos con el resto
// de la app». Antes: un botón sobre un círculo relleno y una barra gruesa de color. Ahora, como en «Crear mi menú»:
// «‹» en jade para volver al paso anterior (× en el primero, que cierra), el avance como una línea cometa fina y, a
// la derecha, lo que lleve cada cuestionario («Omitir», borrar). La usan el del ciclo, el de la medicación y el cuestionario de inicio.
import type { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CometLine } from '@/components/CometLine';
import { FINE } from '@/theme/fine';
import { t } from '@/i18n';

export function StepsBar({
  index,
  total,
  onBack,
  right,
  noClose,
}: {
  index: number; // el paso en el que está, desde 0
  total: number;
  onBack: () => void; // al paso anterior o, en el primero, cerrar
  right?: ReactNode;
  noClose?: boolean; // en el primer paso, sin ×: no hay adónde volver (los primeros pasos de una cuenta nueva)
}) {
  return (
    <View style={styles.bar}>
      {index === 0 && noClose ? (
        <View style={styles.side} />
      ) : (
        <TouchableOpacity style={styles.side} onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel={index > 0 ? t('Back') : t('Close')}>
          <Ionicons name={index > 0 ? 'chevron-back' : 'close'} size={24} color={FINE.jade} />
        </TouchableOpacity>
      )}
      <View
        style={styles.line}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('Step {n} of {total}', { n: index + 1, total })}
        accessibilityValue={{ min: 0, max: total, now: index + 1 }}
      >
        <CometLine progress={(index + 1) / total} colors={['#2F8F70', FINE.jade]} thickness={3} />
      </View>
      {right ?? <View style={styles.side} />}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, paddingRight: 20, paddingTop: 6, minHeight: 50 },
  side: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1 },
});
