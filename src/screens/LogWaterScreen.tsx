import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { WheelPicker } from '@/components/WheelPicker';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { dayKey } from '@/data/bathroomRepository';
import { addWater, GLASS_ML, litres, waterOnDay, waterRepository, waterUsual } from '@/data/waterRepository';
import { SimpleMetricEntry } from '@/types/simpleMetric';
import { dateLocale, t } from '@/i18n';
import { logScreenStyles } from './LogBowelScreen';

// Apuntar una bebida con la rueda, como el resto de mediciones: de 50 en 50 ml, hasta 2 L. Los botones
// de arriba colocan la rueda en un vaso, una lata o una botella; se parte de la última cantidad. «Usar en
// el +» la deja como tu medida (tu botella, tu cantimplora): la que apunta el «+» de Hoy y de Hidratación.
// Debajo, lo apuntado ese día, con una × para quitar lo que sobre (p. ej. un «+» de más).
// ?day=YYYY-MM-DD para otro día (desde la semana de Hidratación).
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
  const [wheelKey, setWheelKey] = useState(0); // recolocar la rueda al cargar o al tocar un botón
  const [entries, setEntries] = useDeepState<SimpleMetricEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [usual, setUsual] = useState(GLASS_ML);

  const load = useCallback(async () => {
    waterUsual.get().then(setUsual).catch(() => undefined);
    const all = await waterRepository.getAll().catch(() => [] as SimpleMetricEntry[]);
    setEntries(all);
    return all;
  }, [setEntries]);
  // La primera vez, la rueda en la última cantidad apuntada
  const [placed, setPlaced] = useState(false);
  useReloadOnFocus(
    useCallback(() => {
      load().then((all) => {
        if (placed || !all.length) return;
        const last = all.reduce((a, x) => (x.createdAt > a.createdAt ? x : a));
        if (VOLUMES.includes(last.valor)) {
          setIndex(indexOf(last.valor));
          setWheelKey((k) => k + 1);
        }
        setPlaced(true);
      });
    }, [load, placed]),
  );

  const pick = (ml: number) => {
    setIndex(indexOf(ml));
    setWheelKey((k) => k + 1);
  };

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
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} onPress={() => router.back()} accessibilityLabel={t('Close')}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.circleButton, styles.circleButtonActive]} onPress={save} disabled={saving} accessibilityLabel={t('Save')}>
          <Ionicons name="checkmark" size={22} color={Colors.background} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={[styles.iconBadge, { backgroundColor: withAlpha(Colors.water, 0.14) }]}>
            <Ionicons name="water-outline" size={26} color={Colors.water} />
          </View>
          <Text style={styles.title}>{t('Add a drink')}</Text>
          <Text style={styles.subtitle}>
            {day === today
              ? t('Water, and also tea, coffee, milk or other drinks: they all count.')
              : t('For {day}. Water, and also tea, coffee, milk or other drinks: they all count.', { day: dayLabel })}
          </Text>
        </View>

        <View style={styles.presets}>
          {[...(PRESETS.some((p) => p.ml === usual) ? [] : [{ label: 'Yours', ml: usual }]), ...PRESETS].map((p) => {
            const on = VOLUMES[index] === p.ml;
            return (
              <TouchableOpacity key={p.label} style={[styles.preset, on && styles.presetOn]} onPress={() => pick(p.ml)} activeOpacity={0.85}>
                <Text style={[styles.presetLabel, on && styles.presetLabelOn]}>{t(p.label)}</Text>
                <Text style={[styles.presetMl, on && styles.presetLabelOn]}>{p.ml} ml</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.wheels} key={wheelKey}>
          <WheelPicker items={VOLUMES.map(String)} selectedIndex={index} onChange={setIndex} width={110} />
          <Text style={styles.wheelUnit}>ml</Text>
        </View>

        {VOLUMES[index] === usual ? (
          <Text style={styles.usualText}>{t('This is the amount the + adds.')}</Text>
        ) : (
          <TouchableOpacity style={styles.usualButton} onPress={makeUsual} activeOpacity={0.85}>
            <Ionicons name="star-outline" size={16} color={Colors.water} />
            <Text style={styles.usualButtonText}>{t('Use {ml} ml for the +', { ml: VOLUMES[index] })}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.askCard}>
          <View style={styles.dayHead}>
            <Text style={styles.askTitle}>{dayLabel}</Text>
            <Text style={styles.dayTotal}>{litres(waterOnDay(entries, day))}</Text>
          </View>
          {ofDay.length === 0 ? (
            <Text style={styles.askText}>{t('Nothing logged yet.')}</Text>
          ) : (
            <View style={styles.chips}>
              {ofDay.map((e) => (
                <View key={e.id} style={styles.chip}>
                  <Text style={styles.chipText}>
                    {new Date(e.fecha).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })} · {e.valor} ml
                  </Text>
                  <TouchableOpacity onPress={() => remove(e.id)} hitSlop={8} accessibilityLabel={t('Remove')}>
                    <Ionicons name="close" size={14} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  ...logScreenStyles,
  presets: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 18 },
  preset: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    minWidth: 74,
  },
  presetOn: { backgroundColor: Colors.water, borderColor: Colors.water },
  presetLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  presetMl: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  presetLabelOn: { color: Colors.background },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  wheelUnit: { color: Colors.textSecondary, fontSize: 16, fontWeight: '700', marginLeft: 8 },
  usualText: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 10 },
  usualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: withAlpha(Colors.water, 0.5),
  },
  usualButtonText: { color: Colors.water, fontSize: 13, fontWeight: '700' },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayTotal: { color: Colors.water, fontSize: 15, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: withAlpha(Colors.water, 0.12),
  },
  chipText: { color: Colors.textPrimary, fontSize: 12, fontWeight: '600' },
});
