import React, { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, withAlpha } from '@/constants/colors';
import { TAB, tabHref } from '@/constants/tabs';

// Piezas comunes de las pantallas del historial y de la tarjeta de emergencia

export function HistFrame({ title, children, right, backFallback = tabHref(TAB.myData) }: { title: string; children?: ReactNode; right?: ReactNode; backFallback?: string }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={title} showBack backFallback={backFallback} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {right ? <View style={styles.right}>{right}</View> : null}
        {children ?? <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, on && styles.chipOn]} onPress={onPress} activeOpacity={0.8} accessibilityState={{ selected: !!on }}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Segment<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.seg}>
      {options.map(([v, label]) => (
        <TouchableOpacity key={v} style={[styles.segBtn, v === value && styles.segOn]} onPress={() => onChange(v)} accessibilityState={{ selected: v === value }}>
          <Text style={[styles.segText, v === value && styles.segTextOn]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function MainButton({ label, onPress, disabled, soft }: { label: string; onPress: () => void; disabled?: boolean; soft?: boolean }) {
  return (
    <TouchableOpacity style={[styles.btn, soft && styles.btnSoft, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled} activeOpacity={0.85}>
      <Text style={[styles.btnText, soft && styles.btnTextSoft]}>{label}</Text>
    </TouchableOpacity>
  );
}

export const hs = StyleSheet.create({
  sub: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  label: { color: Colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  rowTitle: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: Colors.textSecondary, fontSize: 13 },
  tag: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: withAlpha(Colors.textMuted, 0.15), overflow: 'hidden' },
  empty: { color: Colors.textSecondary, fontSize: 14, paddingVertical: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  link: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  meta: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 14 },
  dateBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder },
  dateBtnOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  dateText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  pick: { borderTopWidth: 1, borderTopColor: Colors.divider, paddingVertical: 10 },
  pickHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pickTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  wheels: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  right: { alignItems: 'flex-end', marginTop: -4, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card },
  chipOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: Colors.background },
  seg: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.cardBorder, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  segOn: { backgroundColor: Colors.accentSoft },
  segText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  segTextOn: { color: Colors.textPrimary },
  btn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  btnSoft: { backgroundColor: Colors.accentSoft },
  btnText: { color: Colors.background, fontSize: 16, fontWeight: '800' },
  btnTextSoft: { color: Colors.accent },
});
