import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/colors';
import { medicationRepository } from '@/data/medicationRepository';
import { userFlags } from '@/data/userFlags';
import { currentZone, isActiveOn, offsetText, shiftSchedule, ZoneStamp, zoneChange } from '@/logic/medication';

// "Hemos notado un cambio de hora": si el móvil cambia de zona horaria (un viaje) y hay tomas
// programadas, se pregunta si mantener las horas del reloj o moverlas para que caigan en el mismo
// momento que en casa. La zona conocida se guarda en user_flags ("med_zone").

const KEY = 'med_zone';
const place = (zone: string) => zone.split('/').pop()?.replace(/_/g, ' ') ?? zone;

export function ZoneChangeBanner({ onChanged }: { onChanged?: () => void }) {
  const [change, setChange] = useState<{ from: ZoneStamp; to: ZoneStamp; diff: number } | null>(null);

  useEffect(() => {
    (async () => {
      const meds = (await medicationRepository.getAll().catch(() => [])).filter(
        (m) => isActiveOn(m, new Date()) && m.schedule.type !== 'as_needed'
      );
      const now = currentZone();
      const saved = (await userFlags.get(KEY)) as unknown as ZoneStamp | undefined;
      const valid = saved && typeof saved === 'object' && 'zone' in saved ? saved : null;
      const diff = zoneChange(valid, now);
      if (diff != null && meds.length && valid) setChange({ from: valid, to: now, diff });
      // Primera vez, o solo el horario de verano: se apunta la zona sin preguntar
      else if (!valid || valid.zone !== now.zone || valid.offset !== now.offset)
        await userFlags.set(KEY, now as unknown as Record<string, unknown>);
    })().catch(() => undefined);
  }, []);

  if (!change) return null;

  const keep = async () => {
    await userFlags.set(KEY, change.to as unknown as Record<string, unknown>);
    setChange(null);
  };
  const shift = async () => {
    const meds = await medicationRepository.getAll();
    for (const m of meds.filter((x) => isActiveOn(x, new Date()) && x.schedule.type !== 'as_needed')) {
      await medicationRepository.update(m.id, { schedule: shiftSchedule(m.schedule, change.diff) });
    }
    await userFlags.set(KEY, change.to as unknown as Record<string, unknown>);
    setChange(null);
    onChanged?.();
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="time-outline" size={18} color={Colors.gold} />
        <Text style={styles.title}>We noticed a time change</Text>
      </View>
      <Text style={styles.body}>
        Your phone moved from {place(change.from.zone)} to {place(change.to.zone)} ({offsetText(change.diff)}). Do you want
        to adjust your medication times?
      </Text>
      <TouchableOpacity style={styles.primary} onPress={shift} activeOpacity={0.85}>
        <Text style={styles.primaryText}>Same moment as at home ({offsetText(change.diff)})</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={keep} activeOpacity={0.85}>
        <Text style={styles.secondaryText}>Keep the same clock times</Text>
      </TouchableOpacity>
      <Text style={styles.note}>For the pill or medicines with a strict schedule, ask your pharmacist if unsure.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: withAlpha(Colors.gold, 0.08),
    borderWidth: 1,
    borderColor: withAlpha(Colors.gold, 0.45),
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginBottom: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  body: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  primary: { backgroundColor: Colors.accent, borderRadius: 20, paddingVertical: 10, alignItems: 'center', marginTop: 2 },
  primaryText: { color: Colors.background, fontSize: 13, fontWeight: '800' },
  secondary: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 20, paddingVertical: 9, alignItems: 'center' },
  secondaryText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  note: { color: Colors.textMuted, fontSize: 11, lineHeight: 15 },
});
