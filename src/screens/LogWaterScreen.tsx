import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FineStepper } from '@/components/metas/FineStepper';
import { CloseButton, FineButton, FineChip, FineLink, measureStyles, SecRow } from '@/components/fine/FineMeasure';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { dayKey } from '@/data/bathroomRepository';
import { addWater, GLASS_ML, litres, waterOnDay, waterRepository, waterUsual } from '@/data/waterRepository';
import { SimpleMetricEntry } from '@/types/simpleMetric';
import { dateLocale, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Apuntar una bebida, de 50 en 50 ml, hasta 2 L. Los botones de arriba ponen un vaso, una lata o una botella;
// se parte de la última cantidad. «Usar en el +» la deja como tu medida (tu botella, tu cantimplora): la que
// apunta el «+» de Hoy y de Hidratación. Debajo, lo apuntado ese día, con una × para quitar lo que sobre (p. ej.
// un «+» de más). ?day=YYYY-MM-DD para otro día (desde la semana de Hidratación).
// Desde el 2026-11-16, como en el prototipo: chips con borde, la cantidad grande y ligera con «− +» (en vez de la
// rueda), lo del día en filas con línea fina y un solo botón de Guardar abajo.
const VOLUMES = Array.from({ length: 40 }, (_, i) => (i + 1) * 50);
const PRESETS = [
  { label: 'Glass', ml: GLASS_ML },
  { label: 'Can', ml: 330 },
  { label: 'Bottle', ml: 500 },
  { label: 'Large bottle', ml: 1000 },
];
const indexOf = (ml: number) => Math.max(0, VOLUMES.indexOf(ml));

export const LogWaterScreen = () => {
  const router = useRouter();
  const { day: dayParam } = useLocalSearchParams<{ day?: string }>();
  const today = dayKey(new Date());
  const day = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : today;
  const [index, setIndex] = useState(indexOf(GLASS_ML));
  const [entries, setEntries] = useDeepState<SimpleMetricEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [usual, setUsual] = useState(GLASS_ML);

  const load = useCallback(async () => {
    waterUsual.get().then(setUsual).catch(() => undefined);
    const all = await waterRepository.getAll().catch(() => [] as SimpleMetricEntry[]);
    setEntries(all);
    return all;
  }, [setEntries]);
  // La primera vez, en la última cantidad apuntada
  const [placed, setPlaced] = useState(false);
  useReloadOnFocus(
    useCallback(() => {
      load().then((all) => {
        if (placed || !all.length) return;
        const last = all.reduce((a, x) => (x.createdAt > a.createdAt ? x : a));
        if (VOLUMES.includes(last.valor)) setIndex(indexOf(last.valor));
        setPlaced(true);
      });
    }, [load, placed]),
  );

  const pick = (ml: number) => setIndex(indexOf(ml));

  const save = async () => {
    setSaving(true);
    try {
      await addWater(VOLUMES[index], day);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const makeUsual = async () => {
    setUsual(VOLUMES[index]);
    await waterUsual.set(VOLUMES[index]);
  };

  const remove = async (id: string) => {
    await waterRepository.remove(id);
    load();
  };

  const ofDay = entries.filter((e) => dayKey(new Date(e.fecha)) === day).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const dayLabel = day === today ? t('Today') : new Date(`${day}T12:00:00`).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title={t('Add a drink')} right={<CloseButton onPress={() => router.back()} />} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lead}>
          {day === today
            ? t('Water, and also tea, coffee, milk or other drinks: they all count.')
            : t('For {day}. Water, and also tea, coffee, milk or other drinks: they all count.', { day: dayLabel })}
        </Text>

        <View style={styles.presets}>
          {[...(PRESETS.some((p) => p.ml === usual) ? [] : [{ label: 'Yours', ml: usual }]), ...PRESETS].map((p) => (
            <FineChip key={p.label} label={t(p.label)} sub={`${p.ml} ml`} on={VOLUMES[index] === p.ml} onPress={() => pick(p.ml)} style={styles.preset} />
          ))}
        </View>

        <FineStepper
          value={String(VOLUMES[index])}
          unit="ml"
          onMinus={() => setIndex((i) => Math.max(0, i - 1))}
          onPlus={() => setIndex((i) => Math.min(VOLUMES.length - 1, i + 1))}
          canMinus={index > 0}
          canPlus={index < VOLUMES.length - 1}
          style={styles.stepper}
        />

        {VOLUMES[index] === usual ? (
          <Text style={styles.usualText}>{t('This is the amount the + adds.')}</Text>
        ) : (
          <FineLink icon="star-outline" label={t('Use {ml} ml for the +', { ml: VOLUMES[index] })} onPress={makeUsual} style={styles.usualLink} />
        )}

        {/* Lo de ese día, en filas con línea fina; el total, a la derecha de la cabecera */}
        <SecRow title={dayLabel} right={<Text style={styles.dayTotal}>{litres(waterOnDay(entries, day))}</Text>} />
        {ofDay.length === 0 ? (
          <Text style={styles.empty}>{t('Nothing logged yet.')}</Text>
        ) : (
          ofDay.map((e, i) => (
            <View key={e.id} style={[fine.row, i === ofDay.length - 1 && styles.lastRow]}>
              <Text style={styles.entryTime}>{new Date(e.fecha).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })}</Text>
              <Text style={styles.entryMl}>{e.valor} ml</Text>
              <TouchableOpacity onPress={() => remove(e.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Remove')}>
                <Ionicons name="close" size={18} color={FINE.mute} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <View style={measureStyles.footer}>
        <FineButton label={t('Save')} onPress={save} disabled={saving} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  lead: { ...fine.note, marginTop: 0 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 18 },
  preset: { alignItems: 'center', minWidth: 74, borderRadius: 14 },
  stepper: { marginTop: 24 },
  usualText: { ...fine.note, textAlign: 'center', marginTop: 12 },
  usualLink: { marginTop: 8 },
  dayTotal: { ...ff('regular'), color: FINE.ivory, fontSize: 14, fontVariant: ['tabular-nums'] },
  empty: { ...fine.note, marginTop: 0 },
  lastRow: { borderBottomWidth: 0 },
  entryTime: { ...ff('regular'), color: FINE.mute, fontSize: 13.5, width: 56, fontVariant: ['tabular-nums'] },
  entryMl: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 15, fontVariant: ['tabular-nums'] },
});
