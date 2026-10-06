import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { DailyWearableRecord, WearableMetric } from '@/wearables/types';
import { wearableRepository } from '@/wearables/wearableRepository';
import { generateHuaweiDummy } from '@/wearables/providers/huaweiDummy';
import {
  connectHealthConnect,
  isHealthConnectAvailable,
  readHealthConnectDaily,
} from '@/wearables/providers/healthConnect';

const METRIC_LABEL: Record<WearableMetric, { label: string; unit: string }> = {
  steps: { label: 'Steps', unit: '' },
  resting_heart_rate: { label: 'Resting heart rate', unit: 'bpm' },
  heart_rate_avg: { label: 'Average heart rate', unit: 'bpm' },
  hrv: { label: 'HRV', unit: 'ms' },
  sleep_duration: { label: 'Sleep', unit: '' },
  active_energy: { label: 'Active energy', unit: 'kcal' },
  body_temperature: { label: 'Body temperature', unit: '°C' },
  other: { label: 'Other', unit: '' },
};

const formatValue = (metric: WearableMetric, value: number) => {
  if (metric === 'sleep_duration') return `${Math.floor(value / 60)}h ${String(value % 60).padStart(2, '0')}m`;
  if (metric === 'steps') return value.toLocaleString('en-GB');
  const unit = METRIC_LABEL[metric].unit;
  return unit ? `${value} ${unit}` : String(value);
};

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export const WearablesScreen = () => {
  const [records, setRecords] = useState<DailyWearableRecord[]>([]);
  const [hcAvailable, setHcAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    wearableRepository.getRecords().then(setRecords);
    isHealthConnectAvailable().then(setHcAvailable);
  }, []);

  const run = useCallback(async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    setMessage('');
    try {
      setMessage(await fn());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }, []);

  const loadDummy = () =>
    run('dummy', async () => {
      setRecords(await wearableRepository.upsertRecords(generateHuaweiDummy(14)));
      return 'Loaded 14 days of dummy Huawei Health data.';
    });

  const connectHc = () =>
    run('hc-connect', async () => {
      const ok = await connectHealthConnect();
      return ok ? 'Health Connect permissions granted. Now sync your data.' : 'No permissions were granted.';
    });

  const syncHc = () =>
    run('hc-sync', async () => {
      const fresh = await readHealthConnectDaily(7);
      setRecords(await wearableRepository.upsertRecords(fresh));
      return fresh.length ? `Synced ${fresh.length} daily values from Health Connect.` : 'No data found in Health Connect for the last 7 days.';
    });

  const clearAll = () =>
    run('clear', async () => {
      await wearableRepository.clearRecords();
      setRecords([]);
      return 'Wearable data cleared.';
    });

  // Últimos 7 días con datos, agrupados por fecha.
  const byDate = useMemo(() => {
    const map = new Map<string, DailyWearableRecord[]>();
    for (const r of records) map.set(r.date, [...(map.get(r.date) ?? []), r]);
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7);
  }, [records]);

  const Button = ({ label, onPress, id, disabled }: { label: string; onPress: () => void; id: string; disabled?: boolean }) => (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled || busy !== null}
    >
      {busy === id ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.buttonText}>{label}</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Wearables" showBack />

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="watch-outline" size={24} color={Colors.accent} />
            <Text style={styles.cardTitle}>Huawei Health</Text>
          </View>
          <Text style={styles.cardText}>
            Direct connection coming soon. Until then, load test data with the same shape Huawei will send.
          </Text>
          <Button id="dummy" label="Load dummy Huawei data" onPress={loadDummy} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="fitness-outline" size={24} color={Colors.accent} />
            <Text style={styles.cardTitle}>Health Connect</Text>
          </View>
          <Text style={styles.cardText}>Xiaomi, Garmin, Oura, Samsung, Google and others that sync to Health Connect.</Text>
          {hcAvailable === false ? (
            <Text style={styles.warning}>
              Not available in this build. Health Connect needs the Kuova development build (it does not work in Expo Go).
            </Text>
          ) : (
            <View style={styles.row}>
              <Button id="hc-connect" label="Connect" onPress={connectHc} disabled={!hcAvailable} />
              <Button id="hc-sync" label="Sync last 7 days" onPress={syncHc} disabled={!hcAvailable} />
            </View>
          )}
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <Text style={styles.sectionTitle}>Your last days</Text>
        {byDate.length === 0 ? (
          <Text style={styles.cardText}>No wearable data yet.</Text>
        ) : (
          byDate.map(([date, rows]) => (
            <View key={date} style={styles.dayCard}>
              <Text style={styles.dayTitle}>{formatDate(date)}</Text>
              {rows.map((r) => (
                <View key={`${r.metric}|${r.sourceName}|${r.rawTypeId}`} style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{METRIC_LABEL[r.metric].label}</Text>
                  <View style={styles.metricRight}>
                    <Text style={styles.metricValue}>{formatValue(r.metric, r.value)}</Text>
                    <Text style={styles.metricSource}>{r.sourceName}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}

        {records.length > 0 && (
          <TouchableOpacity onPress={clearAll} style={styles.clear}>
            <Text style={styles.clearText}>Clear wearable data</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40, paddingHorizontal: 20, gap: 12 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  cardText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  warning: { color: Colors.warning, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: Colors.background, fontWeight: '700', fontSize: 15 },
  message: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 8 },
  dayCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  dayTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricLabel: { color: Colors.textSecondary, fontSize: 14 },
  metricRight: { alignItems: 'flex-end' },
  metricValue: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  metricSource: { color: Colors.textMuted, fontSize: 11 },
  clear: { alignSelf: 'center', paddingVertical: 12 },
  clearText: { color: Colors.danger, fontSize: 14 },
});
