// «cm | in»: el interruptor pequeño de la unidad de la cinta en Medidas (fundador, 2026-11-16: «quiero que puedas
// cambiar las unidades (inch - cm)»). Con el aire de MeasureTabs: borde fino y la elegida con borde de jade
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { LENGTH_UNITS, type LengthUnit } from '@/logic/lengthUnits';
import { t } from '@/i18n';
import { FINE, ff } from '@/theme/fine';

const NAME: Record<LengthUnit, string> = { cm: 'Centimetres', in: 'Inches' };

export function LengthUnitSwitch({ value, onChange, style }: { value: LengthUnit; onChange: (unit: LengthUnit) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.wrap, style]} accessibilityRole="radiogroup" accessibilityLabel={t('Units')}>
      {LENGTH_UNITS.map((u) => {
        const on = value === u;
        return (
          <TouchableOpacity
            key={u}
            style={[styles.seg, on && styles.segOn]}
            onPress={() => onChange(u)}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8 }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={t(NAME[u])}
          >
            <Text style={[styles.text, on && styles.textOn]}>{u}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', padding: 2, gap: 2, borderRadius: 16, borderWidth: 1, borderColor: FINE.line },
  seg: { flex: 1, minHeight: 26, paddingHorizontal: 9, borderRadius: 13, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  segOn: { borderColor: FINE.jade },
  text: { ...ff('regular'), fontSize: 12.5, color: FINE.mute },
  textOn: { color: FINE.ivory },
});
