import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { medicationRepository } from '@/data/medicationRepository';
import { userFlags } from '@/data/userFlags';
import { currentZone, isActiveOn, offsetText, shiftSchedule, ZoneStamp, zoneChange } from '@/logic/medication';
import { t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// "Hemos notado un cambio de hora": si el móvil cambia de zona horaria (un viaje) y hay tomas
// programadas, se pregunta si mantener las horas del reloj o moverlas para que caigan en el mismo
// momento que en casa. La zona conocida se guarda en user_flags ("med_zone").
// Desde el 2026-11-17, en el lenguaje fino como el resto de la medicación: una tarjeta casi transparente con el
// borde de oro (algo que hay que revisar), sin icono ni fondo de color; la opción principal, en la píldora
// esmeralda y la otra, con borde fino.

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
      <Text style={styles.title}>{t('We noticed a time change')}</Text>
      <Text style={styles.body}>
        {t('Your phone moved from {from} to {to} ({offset}). Do you want to adjust your medication times?', {
          from: place(change.from.zone),
          to: place(change.to.zone),
          offset: offsetText(change.diff),
        })}
      </Text>
      <TouchableOpacity style={styles.primary} onPress={shift} activeOpacity={0.85}>
        <Text style={styles.primaryText}>{t('Same moment as at home ({offset})', { offset: offsetText(change.diff) })}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={keep} activeOpacity={0.85}>
        <Text style={styles.secondaryText}>{t('Keep the same clock times')}</Text>
      </TouchableOpacity>
      <Text style={styles.note}>{t('For the pill or medicines with a strict schedule, ask your pharmacist if unsure.')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...fine.tile, borderColor: FINE.goldLine, padding: 14, gap: 8, marginBottom: 10 },
  title: { ...ff('medium'), color: FINE.ivory, fontSize: 15, lineHeight: 20 },
  body: { ...ff('regular'), color: '#CFD6CF', fontSize: 13.5, lineHeight: 19 },
  primary: { ...fine.pill, minHeight: 40, marginTop: 2 },
  primaryText: { ...fine.pillText },
  secondary: { minHeight: 40, borderWidth: 1, borderColor: 'rgba(240,239,230,0.16)', borderRadius: 20, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { ...ff('regular'), color: FINE.ivory, fontSize: 13 },
  note: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, lineHeight: 16 },
});
