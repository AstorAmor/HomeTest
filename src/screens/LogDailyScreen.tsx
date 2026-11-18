import { dateLocale, t } from '@/i18n';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { DateTimeSheet } from '@/components/DateTimeSheet';
import { ScreenHeader } from '@/components/ScreenHeader';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { KeyboardFooter } from '@/components/KeyboardFooter';
import { FRow } from '@/components/fine/Fine';
import { CloseButton, FineButton, measureStyles } from '@/components/fine/FineMeasure';
import { FineNumber, useNumbersReady } from '@/components/fine/FineNumber';
import { wearableRepository } from '@/wearables/wearableRepository';
import { pickPerDay, localDayKey } from '@/wearables/seriesLogic';
import { MANUAL_SOURCE } from '@/wearables/sources';
import { DailyWearableRecord } from '@/wearables/types';
import { FINE, ff, fine } from '@/theme/fine';

// Pasos y sueño apuntados a mano, desde la K (fundador, 2026-11-18: «quiero poder añadir también pasos y sueño»). Se
// guardan como un dato diario más, con la fuente «A mano», junto a los del reloj (wearable_daily): así salen solos en
// Hoy, en la preparación y en los objetivos. Ese día manda lo apuntado a mano (src/wearables/seriesLogic.ts) y borrar
// los datos del reloj no lo quita. La cifra empieza en lo que ya hay de ese día (lo del reloj, para corregirlo) y, si no
// hay nada, en un valor de partida. El sueño va en horas con un decimal y se guarda en minutos, como el del reloj.

type Kind = 'steps' | 'sleep';

const CONFIG: Record<Kind, { title: string; metric: 'steps' | 'sleep_duration'; unit: string; min: number; max: number; step: number; fastStep: number; decimals: number; initial: number; hint: string }> = {
  steps: { title: 'Steps', metric: 'steps', unit: 'steps', min: 0, max: 100000, step: 100, fastStep: 1000, decimals: 0, initial: 6000, hint: 'All the steps of that day.' },
  sleep: { title: 'Sleep', metric: 'sleep_duration', unit: 'h', min: 0, max: 16, step: 0.5, fastStep: 1, decimals: 1, initial: 7, hint: 'The night that ends on that day.' },
};

// La cifra que se ve (horas en el sueño) y lo que se guarda (minutos)
const toShown = (kind: Kind, v: number) => (kind === 'sleep' ? Math.round((v / 60) * 10) / 10 : v);
const toStored = (kind: Kind, v: number) => (kind === 'sleep' ? Math.round(v * 60) : Math.round(v));

const formatDate = (date: Date) => date.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' });

const manualRecord = (kind: Kind, date: string, value: number): DailyWearableRecord => ({
  date,
  metric: CONFIG[kind].metric,
  value,
  sourceName: MANUAL_SOURCE,
  provider: 'manual',
  rawTypeId: 'manual',
  rawTypeName: 'Manual',
});

export const LogDailyScreen = ({ kind }: { kind: Kind }) => {
  const router = useRouter();
  const c = CONFIG[kind];
  const [date, setDate] = useState(() => new Date());
  const [value, setValue] = useState(c.initial);
  const [mine, setMine] = useState<DailyWearableRecord | null>(null); // lo apuntado a mano ese día, si lo hay
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const numbers = useNumbersReady();
  const day = localDayKey(date);

  // Al cambiar de día: lo que ya hay (lo apuntado a mano o, si no, lo del reloj)
  useEffect(() => {
    let alive = true;
    wearableRepository
      .getRecords()
      .then((records) => {
        if (!alive) return;
        const ofDay = records.filter((r) => r.date === day && r.metric === c.metric);
        const manual = ofDay.find((r) => r.provider === 'manual') ?? null;
        const shown = pickPerDay(ofDay)[0];
        setMine(manual);
        setValue(shown ? toShown(kind, shown.value) : c.initial);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [day, kind, c.metric, c.initial]);

  const onPick = (_e: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setPicker(false);
    if (selected) setDate(selected);
  };

  const save = async () => {
    setSaving(true);
    try {
      await wearableRepository.upsertRecords([manualRecord(kind, day, toStored(kind, value))]);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!mine) return;
    await wearableRepository.removeRecord(mine);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title={t(c.title)} right={<CloseButton onPress={() => router.back()} />} />

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FineNumber
          value={value}
          onChange={setValue}
          min={c.min}
          max={c.max}
          decimals={c.decimals}
          step={c.step}
          fastStep={c.fastStep}
          unit={t(c.unit)}
          label={t(c.title)}
          onValidChange={numbers.watch('value')}
          style={styles.number}
        />
        <View style={styles.rows}>
          <FRow
            title={t('Date')}
            value={formatDate(date)}
            onPress={() => {
              Keyboard.dismiss();
              setPicker(true);
            }}
            last
          />
        </View>
        <Text style={fine.note}>{t(c.hint)}</Text>
      </KeyboardAwareScrollView>

      <KeyboardFooter>
        <View style={measureStyles.footer}>
          <FineButton label={t('Save')} onPress={save} disabled={!numbers.ready || saving} />
          {mine && (
            <TouchableOpacity style={styles.deleteButton} onPress={remove} hitSlop={8} accessibilityRole="button">
              <Ionicons name="trash-outline" size={15} color={FINE.mute} />
              <Text style={styles.deleteText}>{t('Delete entry')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardFooter>

      <DateTimeSheet mode={picker ? 'date' : null} value={date} onChange={onPick} onClose={() => setPicker(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  number: { marginTop: 26, marginBottom: 18 },
  rows: { borderTopWidth: 1, borderTopColor: FINE.line },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 4 },
  deleteText: { ...ff('regular'), color: FINE.mute, fontSize: 14 },
});
