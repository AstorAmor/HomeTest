import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { SimulationDay } from '@/logic/nudges';

// Línea de tiempo de un usuario simulado: cada día con avisos (enviados o retenidos) y el motivo.
// La usan Simulated users y Build a case (modo desarrollador).

export const STATUS_LABEL: Record<string, string> = {
  send: 'sent',
  muted: 'muted',
  cooldown: 'waiting',
  daily_limit: 'daily limit',
  not_due: 'not due',
  missing: 'missing',
};

export const statusColor = (status: string) =>
  ({ send: Colors.ok, muted: Colors.textMuted, cooldown: Colors.gold, daily_limit: Colors.attention })[status] ??
  Colors.textMuted;

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
                    <Text style={{ color: statusColor(x.status), fontWeight: '800' }}>{STATUS_LABEL[x.status]}</Text>{' '}
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
  empty: { color: Colors.textMuted, fontSize: 12, paddingVertical: 6 },
  dayRow: { flexDirection: 'row', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  today: { backgroundColor: Colors.accentSoft, borderRadius: 8, paddingHorizontal: 6 },
  dayLabel: { width: 54, color: Colors.textPrimary, fontSize: 12, fontWeight: '700' },
  dayDate: { color: Colors.textMuted, fontSize: 11, fontWeight: '500' },
  eventText: { color: Colors.gold, fontSize: 12, fontWeight: '600' },
  nudgeText: { color: Colors.textPrimary, fontSize: 12 },
  body: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  reason: { color: Colors.textMuted, fontSize: 11, lineHeight: 15 },
});
