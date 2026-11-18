import { dateLocale, t } from '@/i18n';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MonthCalendar, toDayKey } from '@/components/MonthCalendar';
import { FRow } from '@/components/fine/Fine';
import { FButton, FLink, formStyles } from '@/components/fine/FineForm';
import { cycleRepository } from '@/data/cycleRepository';
import { FINE } from '@/theme/fine';

const DAY_MS = 24 * 3600 * 1000;
const fromKey = (key: string) => new Date(`${key}T12:00:00`);
const formatDay = (key: string) =>
  fromKey(key).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' });

// "Log period": primer día y último día de la regla (duración), en un calendario.
// Primer toque = inicio; segundo toque = fin. Si aún no ha terminado, se guarda solo el inicio.
// En el lenguaje fino desde el 2026-11-17, como el detalle del ciclo: × en jade arriba, el título a la izquierda, el
// calendario entre dos líneas finas, el resumen en filas finas y «Guardar» abajo (antes, botones redondos con la marca
// arriba, el loto en un círculo rosa y tres tarjetas). «Borrar registro», un enlace apagado sin rojo.
export const LogCycleScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const today = toDayKey(new Date());
  const [month, setMonth] = useState(new Date());
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    cycleRepository.getAll().then((entries) => {
      const existing = entries.find((e) => e.id === id);
      if (!existing) return;
      const s = toDayKey(new Date(existing.fecha));
      setStart(s);
      setEnd(existing.endFecha ? toDayKey(new Date(existing.endFecha)) : null);
      setMonth(fromKey(s));
    });
  }, [id]);

  const onDayPress = (day: string) => {
    if (!start || (start && end) || day < start) {
      setStart(day);
      setEnd(null);
    } else {
      setEnd(day);
    }
  };

  const days = start ? Math.round((fromKey(end ?? start).getTime() - fromKey(start).getTime()) / DAY_MS) + 1 : 0;

  const handleSave = async () => {
    if (!start) return;
    setSaving(true);
    try {
      const values = {
        fecha: fromKey(start).toISOString(),
        endFecha: end ? fromKey(end).toISOString() : undefined,
      };
      if (isEditing && id) {
        await cycleRepository.update(id, { ...values, endFecha: values.endFecha ?? null } as any);
      } else {
        await cycleRepository.save({ id: `${Date.now()}`, createdAt: new Date().toISOString(), ...values });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    await cycleRepository.remove(id);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.close} onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Close')}>
          <Ionicons name="close" size={24} color={FINE.jade} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          {t('Log period')}
        </Text>
        <Text style={styles.lead}>
          {t('Tap the first day, then the last day. If it has not finished yet, just save the first day and add the end later.')}
        </Text>

        <View style={styles.calendar}>
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            rangeStart={start}
            rangeEnd={end}
            onDayPress={onDayPress}
            maxDate={today}
          />
        </View>

        <FRow title={t('Started')} value={start ? formatDay(start) : '—'} />
        <FRow title={t('Ended')} value={end ? formatDay(end) : start ? t('Ongoing') : '—'} />
        <FRow title={t('Duration')} value={start && end ? t('{n} days', { n: days }) : '—'} last />

        {isEditing && <FLink label={t('Delete entry')} onPress={handleDelete} muted style={styles.delete} />}
      </ScrollView>

      <View style={styles.footer}>
        <FButton label={t('Save')} onPress={handleSave} disabled={!start} busy={saving} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  topBar: { flexDirection: 'row', paddingLeft: 10, paddingTop: 6, minHeight: 50, alignItems: 'center' },
  close: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  title: { ...formStyles.q },
  lead: { ...formStyles.lead, marginBottom: 18 },
  // El calendario, sin tarjeta: entre dos líneas finas (como en el cuestionario del ciclo)
  calendar: { paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: FINE.line, marginBottom: 6 },
  delete: { marginTop: 20 },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
});
