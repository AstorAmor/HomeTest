import { dateLocale, t } from '@/i18n';
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SecHead, Tag } from '@/components/fine/Fine';
import { FButton, FLink } from '@/components/fine/FineForm';
import { mockUpcomingAnalyses } from '@/data/mockData';
import { FINE, ff, fine } from '@/theme/fine';

const formatLongDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
const capitalised = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Huecos alternativos (dummy): los próximos días laborables a partir de la fecha actual del test.
function nextSlots(fromIso: string, count = 5) {
  const slots: string[] = [];
  const d = new Date(`${fromIso}T12:00:00`);
  while (slots.length < count) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) slots.push(d.toISOString().slice(0, 10));
  }
  return slots;
}

// Tu próximo análisis (/upcoming-analysis?id=…, «Analítica de sangre» en Análisis). Desde el 2026-11-18 en el
// lenguaje fino (fundador: «en Analítica de sangre me parece que es una estética antigua»): la fecha grande y
// ligera con la entrega y la muestra apagadas, qué se mide por áreas en filas con línea fina (sin chips de color),
// cómo prepararte con una marca a línea en jade, el botón esmeralda y la acción secundaria en jade. La hoja de
// cambiar o cancelar, igual: filas finas y sin rojos.
export const UpcomingAnalysisScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const analysis = mockUpcomingAnalyses.find((a) => a.id === id) ?? mockUpcomingAnalyses[0];
  const [date, setDate] = useState(analysis.fecha);
  const [status, setStatus] = useState<'scheduled' | 'confirmed' | 'cancelled'>('scheduled');
  const [sheet, setSheet] = useState<null | 'menu' | 'reschedule' | 'cancel'>(null);
  const slots = useMemo(() => nextSlots(analysis.fecha), [analysis.fecha]);
  const markerCount = analysis.markerGroups.reduce((n, g) => n + g.markers.length, 0);
  const cancelled = status === 'cancelled';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={analysis.nombre} showBack />

        <View style={styles.body}>
          {/* La fecha, grande y ligera; debajo, la entrega y la muestra */}
          <Text style={[styles.heroDate, cancelled && { color: FINE.mute }]}>{cancelled ? t('Cancelled') : capitalised(formatLongDate(date))}</Text>
          {!cancelled && <Text style={styles.heroLine}>{t('Delivery {time}', { time: analysis.timeSlot })}</Text>}
          <Text style={styles.heroLine}>{analysis.sampleType}</Text>
          {status === 'confirmed' && (
            <View style={styles.tag}>
              <Tag label={t('Confirmed')} />
            </View>
          )}

          {/* Qué se mide: un área por fila, con sus marcadores */}
          <SecHead title={t("What we'll measure")} />
          <Text style={[fine.note, styles.count]}>{t('{n} markers', { n: markerCount })}</Text>
          {analysis.markerGroups.map((g, i) => (
            <View key={g.category} style={[fine.row, styles.group, i === analysis.markerGroups.length - 1 && styles.noLine]}>
              <Text style={styles.groupTitle}>{g.category}</Text>
              <Text style={styles.groupMarkers}>{g.markers.join(' · ')}</Text>
            </View>
          ))}

          {/* Cómo prepararte */}
          <SecHead title={t('How to prepare')} />
          {analysis.preparation.map((p, i) => (
            <View key={p} style={[fine.row, i === analysis.preparation.length - 1 && styles.noLine]}>
              <Ionicons name="checkmark" size={16} color={FINE.jade} />
              <Text style={[fine.body, styles.flex]}>{p}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {!cancelled && (
        <View style={styles.actions}>
          {status === 'scheduled' && <FButton label={t('Confirm date')} onPress={() => setStatus('confirmed')} />}
          <FLink label={t('Reschedule or cancel')} onPress={() => setSheet('menu')} />
        </View>
      )}

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          {sheet === 'menu' && (
            <>
              <Text style={styles.sheetTitle}>{t('Change this test')}</Text>
              <SheetRow icon="calendar-outline" label={t('Reschedule')} onPress={() => setSheet('reschedule')} />
              <SheetRow icon="close-outline" label={t('Cancel test')} onPress={() => setSheet('cancel')} last />
            </>
          )}
          {sheet === 'reschedule' && (
            <>
              <Text style={styles.sheetTitle}>{t('Pick a new date')}</Text>
              {slots.map((s, i) => (
                <SheetRow
                  key={s}
                  icon="time-outline"
                  label={`${capitalised(formatLongDate(s))} · ${analysis.timeSlot}`}
                  onPress={() => {
                    setDate(s);
                    setStatus('confirmed');
                    setSheet(null);
                  }}
                  last={i === slots.length - 1}
                />
              ))}
            </>
          )}
          {sheet === 'cancel' && (
            <>
              <Text style={styles.sheetTitle}>{t('Cancel this test?')}</Text>
              <Text style={styles.sheetText}>{t('It stays included in your subscription, so you can book it again whenever you want.')}</Text>
              <FButton
                label={t('Yes, cancel')}
                onPress={() => {
                  setStatus('cancelled');
                  setSheet(null);
                }}
              />
              <FLink label={t('Keep it')} onPress={() => setSheet(null)} />
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Una opción de la hoja: icono a línea en jade, el texto y la flecha, con una línea fina debajo
function SheetRow({ icon, label, onPress, last }: { icon: string; label: string; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity style={[fine.row, last && styles.noLine]} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      <Ionicons name={icon as any} size={18} color={FINE.jade} />
      <Text style={[fine.rowTitle, styles.flex]}>{label}</Text>
      <Ionicons name="chevron-forward" size={15} color={FINE.mute} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 24 },
  body: { paddingHorizontal: 20 },
  flex: { flex: 1 },
  noLine: { borderBottomWidth: 0 },
  heroDate: { ...fine.num, fontSize: 30, lineHeight: 36, letterSpacing: -0.3, marginTop: 4 },
  heroLine: { ...ff('regular'), color: FINE.mute, fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  tag: { flexDirection: 'row', marginTop: 10 },
  count: { marginTop: -4, marginBottom: 2 },
  group: { flexDirection: 'column', alignItems: 'flex-start', gap: 3 },
  groupTitle: { ...fine.kicker },
  groupMarkers: { ...ff('regular'), color: FINE.ivory, fontSize: 14, lineHeight: 20 },
  actions: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, gap: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  // Como la hoja «Apuntar» de la K (BottomTabBar): esmeralda muy oscuro con una línea fina arriba
  sheet: {
    backgroundColor: '#0A2019',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: FINE.line,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: FINE.rule, marginBottom: 14 },
  sheetTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 18, marginBottom: 4 },
  sheetText: { ...ff('regular'), color: FINE.mute, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 14 },
});
