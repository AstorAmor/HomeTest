import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SimulationDay } from '@/logic/nudges';
import { FINE, ff } from '@/theme/fine';

// Línea de tiempo de un usuario simulado: cada día con avisos (enviados o retenidos) y el motivo.
// La usan Simulated users y Build a case (modo desarrollador).
// Desde el 2026-11-17, con los colores del lenguaje fino: enviado en jade, retenido en oro y lo demás apagado
// (sin naranja ni rojo); el día de hoy, con el fondo apenas marcado.

export const STATUS_LABEL: Record<string, string> = {
  send: 'sent',
  muted: 'muted',
  cooldown: 'waiting',
  daily_limit: 'daily limit',
  not_due: 'not due',
  missing: 'missing',
};

export const statusColor = (status: string) =>
  ({ send: FINE.jade, muted: FINE.mute, cooldown: FINE.gold, daily_limit: FINE.gold })[status] ?? FINE.mute;

const interesting = (d: SimulationDay, onlySent: boolean) =>
  d.decisions.some((x) => (onlySent ? x.status === 'send' : x.status !== 'not_due')) ||
  d.events.some((e) => e.startsWith('mutes') || e.startsWith('unmutes'));

export function NudgeTimeline({
  days,
  showText = false,
  onlySent = false,
}: {
  days: SimulationDay[];
  showText?: boolean;
  onlySent?: boolean; // solo los días con avisos enviados (sin los retenidos por espera o límite)
}) {
  const shown = days.filter((d) => interesting(d, onlySent));
  if (!shown.length) return <Text style={styles.empty}>No notifications on any of these days.</Text>;
  return (
    <View>
      {shown.map((d) => (
        <View key={d.day} style={[styles.dayRow, d.day === 0 && styles.today]}>
          <Text style={styles.dayLabel}>
            {d.day === 0 ? 'Today' : `Day ${d.day}`}
            {'\n'}
            <Text style={styles.dayDate}>{d.date.slice(5)}</Text>
          </Text>
          <View style={{ flex: 1, gap: 4 }}>
            {d.events
              .filter((e) => e.startsWith('mutes') || e.startsWith('unmutes') || e.startsWith('cycle goal'))
              .map((e) => (
                <Text key={e} style={styles.eventText}>
                  {e}
                </Text>
              ))}
            {d.decisions
              .filter((x) => (onlySent ? x.status === 'send' : x.status !== 'not_due'))
              .map((x) => (
                <View key={x.id}>
                  <Text style={styles.nudgeText}>
                    <Text style={{ color: statusColor(x.status), ...ff('medium') }}>{STATUS_LABEL[x.status]}</Text>{' '}
                    {showText && x.title ? x.title : x.label}
                  </Text>
                  {showText && x.status === 'send' && x.body ? <Text style={styles.body}>{x.body}</Text> : null}
                  <Text style={styles.reason}>{x.reason}</Text>
                </View>
              ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { ...ff('regular'), color: FINE.mute, fontSize: 12, paddingVertical: 6 },
  dayRow: { flexDirection: 'row', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: FINE.line },
  today: { backgroundColor: 'rgba(131,214,180,0.08)', borderRadius: 8, paddingHorizontal: 6 },
  dayLabel: { ...ff('medium'), width: 54, color: FINE.ivory, fontSize: 12 },
  dayDate: { ...ff('regular'), color: FINE.mute, fontSize: 11 },
  eventText: { ...ff('regular'), color: FINE.gold, fontSize: 12 },
  nudgeText: { ...ff('regular'), color: FINE.ivory, fontSize: 12 },
  body: { ...ff('regular'), color: FINE.mute, fontSize: 12, lineHeight: 17 },
  reason: { ...ff('regular'), color: FINE.mute, fontSize: 11, lineHeight: 15 },
});
