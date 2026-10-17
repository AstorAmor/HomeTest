import { dateLocale, t } from '@/i18n';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { DailyWearableRecord, WearableMetric } from '@/wearables/types';
import { wearableRepository } from '@/wearables/wearableRepository';
import { generateHuaweiDummy } from '@/wearables/providers/huaweiDummy';
import { TAB, tabHref } from '@/constants/tabs';
import { showSamples } from '@/data/dataMode';
import { localDayKey, pickPerDay, syncHealthConnectIfDue } from '@/wearables/dailySeries';
import { sourceLabel } from '@/wearables/sourceLabel';
import {
  connectHealthConnect,
  grantedTypes,
  isHealthConnectAvailable,
  lastHealthConnectSync,
  openHealthConnectSettings,
  PHONE_SOURCE,
  readTypes,
  TYPE_LABEL,
} from '@/wearables/providers/healthConnect';

const METRIC_LABEL: Record<WearableMetric, { label: string; unit: string }> = {
  steps: { label: 'Steps', unit: '' },
  resting_heart_rate: { label: 'Resting heart rate', unit: 'bpm' },
  heart_rate_avg: { label: 'Average heart rate', unit: 'bpm' },
  hrv: { label: 'HRV', unit: 'ms' },
  sleep_duration: { label: 'Sleep', unit: '' },
  active_energy: { label: 'Active energy', unit: 'kcal' },
  body_temperature: { label: 'Body temperature', unit: '°C' },
  distance: { label: 'Distance', unit: 'km' },
  other: { label: 'Other', unit: '' },
};
const METRIC_ORDER: WearableMetric[] = ['steps', 'sleep_duration', 'resting_heart_rate', 'heart_rate_avg', 'hrv', 'active_energy', 'distance', 'body_temperature', 'other'];

// Tipo de Health Connect → métrica de Kuova (para el resumen de qué llega)
const TYPE_METRIC: Record<string, WearableMetric> = {
  Steps: 'steps',
  SleepSession: 'sleep_duration',
  RestingHeartRate: 'resting_heart_rate',
  HeartRate: 'heart_rate_avg',
  HeartRateVariabilityRmssd: 'hrv',
  ActiveCaloriesBurned: 'active_energy',
  Distance: 'distance',
};

const formatValue = (metric: WearableMetric, value: number) => {
  if (metric === 'sleep_duration') return `${Math.floor(value / 60)}h ${String(Math.round(value % 60)).padStart(2, '0')}m`;
  if (metric === 'steps') return value.toLocaleString(dateLocale());
  if (metric === 'distance') return `${(value / 1000).toLocaleString(dateLocale(), { maximumFractionDigits: 1 })} km`;
  const unit = METRIC_LABEL[metric].unit;
  return unit ? `${value} ${unit}` : String(value);
};

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' });

const timeAgo = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return t('just now');
  if (min < 60) return t('{n} min ago', { n: min });
  const h = Math.round(min / 60);
  return h < 24 ? t('{n} h ago', { n: h }) : t('{n} d ago', { n: Math.round(h / 24) });
};

export const WearablesScreen = () => {
  const [records, setRecords] = useState<DailyWearableRecord[]>([]);
  const [hcAvailable, setHcAvailable] = useState<boolean | null>(null);
  const [granted, setGranted] = useState<string[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const samples = showSamples();

  const refresh = useCallback(async () => {
    setRecords(await wearableRepository.getRecords().catch(() => []));
    setGranted(await grantedTypes());
    setLastSync(await lastHealthConnectSync());
  }, []);

  useEffect(() => {
    refresh();
    isHealthConnectAvailable().then(setHcAvailable);
  }, [refresh]);

  const run = useCallback(async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    setMessage('');
    try {
      setMessage(await fn());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('Something went wrong'));
    } finally {
      setBusy(null);
    }
  }, []);

  const loadDummy = () =>
    run('dummy', async () => {
      setRecords(await wearableRepository.upsertRecords(generateHuaweiDummy(14)));
      return t('Loaded 14 days of dummy Huawei Health data.');
    });

  const sync = () =>
    run('hc-sync', async () => {
      const changed = await syncHealthConnectIfDue(true);
      await refresh();
      return changed ? t('Synced the last 30 days from Health Connect.') : t('No data found in Health Connect for the last 30 days.');
    });

  // Conectar = pedir permisos y, si los da, sincronizar ya (antes eran dos botones)
  const connect = () =>
    run('hc-connect', async () => {
      const ok = await connectHealthConnect();
      setGranted(ok);
      if (!ok.length) return t('No permissions were granted.');
      await syncHealthConnectIfDue(true);
      await refresh();
      return t('Connected. Your data will update every time you open Today.');
    });

  const clearAll = () =>
    run('clear', async () => {
      await wearableRepository.clearRecords();
      setRecords([]);
      return t('Wearable data cleared.');
    });

  // Qué llega de cada tipo en los últimos 30 días: días con dato y de qué apps
  const coverage = useMemo(() => {
    const since = localDayKey(new Date(Date.now() - 29 * 86400000));
    const hc = records.filter((r) => r.provider === 'health_connect' && r.date >= since);
    return readTypes().map((type) => {
      const metric = TYPE_METRIC[type];
      const rows = hc.filter((r) => r.metric === metric);
      const sources = new Set<string>();
      rows.forEach((r) => r.sourceName.split(' + ').forEach((s) => sources.add(s)));
      const estimated = type === 'RestingHeartRate' && rows.length > 0 && rows.every((r) => r.rawTypeId.includes(':'));
      return { type, allowed: granted.includes(type), days: new Set(rows.map((r) => r.date)).size, sources: [...sources], estimated };
    });
  }, [records, granted]);
  const connected = granted.length > 0;
  const onlyPhone =
    connected && coverage.some((c) => c.days > 0) && coverage.every((c) => c.sources.every((s) => s === PHONE_SOURCE));
  const missingPermissions = connected && coverage.some((c) => !c.allowed);

  // Últimos 7 días con datos, agrupados por fecha (una fuente por métrica y día, la que usa la app)
  const byDate = useMemo(() => {
    const map = new Map<string, DailyWearableRecord[]>();
    for (const r of pickPerDay(records)) map.set(r.date, [...(map.get(r.date) ?? []), r]);
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7)
      .map(([date, rows]) => [date, rows.sort((a, b) => METRIC_ORDER.indexOf(a.metric) - METRIC_ORDER.indexOf(b.metric))] as const);
  }, [records]);

  // `grow`: reparte el ancho con otro botón de la misma fila. Solo, el botón no lleva flex (en una
  // columna de alto automático, flex: 1 lo encogía y el texto no quedaba centrado).
  const Button = ({ label, onPress, id, disabled, ghost, grow }: { label: string; onPress: () => void; id: string; disabled?: boolean; ghost?: boolean; grow?: boolean }) => (
    <TouchableOpacity
      style={[styles.button, grow && styles.buttonGrow, ghost && styles.buttonGhost, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled || busy !== null}
    >
      {busy === id ? (
        <ActivityIndicator color={ghost ? Colors.accent : Colors.background} />
      ) : (
        <Text style={[styles.buttonText, ghost && styles.buttonGhostText]}>{label}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Wearables')} showBack backFallback={tabHref(TAB.more)} />

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="fitness-outline" size={24} color={Colors.accent} />
            <Text style={styles.cardTitle}>{t('Health Connect')}</Text>
            {connected && (
              <View style={styles.okPill}>
                <Ionicons name="checkmark" size={12} color={Colors.ok} />
                <Text style={styles.okPillText}>{t('Connected')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardText}>{t('Fitbit, Xiaomi, Garmin, Oura, Samsung, Google and others that sync to Health Connect.')}</Text>
          {hcAvailable === false ? (
            <Text style={styles.warning}>{t('Health Connect only works in the Kuova app for Android (not in the browser or Expo Go).')}</Text>
          ) : connected ? (
            <>
              <View style={styles.row}>
                <Button id="hc-sync" label={t('Sync now')} onPress={sync} grow />
                <Button id="hc-settings" label={t('Permissions')} onPress={openHealthConnectSettings} ghost grow />
              </View>
              <Text style={styles.syncText}>
                {lastSync ? t('Last sync {ago}. It also syncs by itself when you open Today.', { ago: timeAgo(lastSync) }) : t('It syncs by itself when you open Today.')}
              </Text>
            </>
          ) : (
            <Button id="hc-connect" label={t('Connect Health Connect')} onPress={connect} disabled={!hcAvailable} />
          )}
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        {connected && (
          <>
            <Text style={styles.sectionTitle}>{t('What arrives (last 30 days)')}</Text>
            <View style={styles.card}>
              {coverage.map((c) => (
                <View key={c.type} style={styles.coverRow}>
                  <Ionicons
                    name={!c.allowed ? 'lock-closed-outline' : c.days ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={!c.allowed ? Colors.textMuted : c.days ? Colors.ok : Colors.warning}
                  />
                  <Text style={styles.coverLabel}>{t(TYPE_LABEL[c.type])}</Text>
                  <Text style={styles.coverValue} numberOfLines={2}>
                    {!c.allowed
                      ? t('No permission')
                      : c.days
                        ? `${t(c.days === 1 ? '{n} day' : '{n} days', { n: c.days })} · ${sourceLabel(c.sources)}${c.estimated ? ` · ${t('estimated from heart rate')}` : ''}`
                        : t('No data')}
                  </Text>
                </View>
              ))}
              {onlyPhone && (
                <Text style={styles.hint}>
                  {t('Only your phone is sending data (steps). If you wear a watch, open its app (Fitbit, Mi Fitness, Samsung Health…) and turn on sharing with Health Connect. Then tap Sync now.')}
                </Text>
              )}
              {missingPermissions && (
                <>
                  <Text style={styles.hint}>{t('Some types have no permission yet. Allow them so Kuova can use them.')}</Text>
                  <Button id="hc-connect" label={t('Allow the missing ones')} onPress={connect} />
                </>
              )}
            </View>
          </>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="watch-outline" size={24} color={Colors.accent} />
            <Text style={styles.cardTitle}>{t('Huawei Health')}</Text>
          </View>
          <Text style={styles.cardText}>
            {samples
              ? t('Direct connection coming soon. Until then, load test data with the same shape Huawei will send.')
              : t('Direct connection coming soon. Huawei Health does not share with Health Connect yet.')}
          </Text>
          {samples && <Button id="dummy" label={t('Load dummy Huawei data')} onPress={loadDummy} />}
        </View>

        <Text style={styles.sectionTitle}>{t('Your last days')}</Text>
        {byDate.length === 0 ? (
          <Text style={styles.cardText}>{t('No wearable data yet.')}</Text>
        ) : (
          byDate.map(([date, rows]) => (
            <View key={date} style={styles.dayCard}>
              <Text style={styles.dayTitle}>{formatDate(date)}</Text>
              {rows.map((r) => (
                <View key={`${r.metric}|${r.sourceName}|${r.rawTypeId}`} style={styles.metricRow}>
                  <Text style={styles.metricLabel} numberOfLines={1}>
                    {t(METRIC_LABEL[r.metric].label)}
                  </Text>
                  <View style={styles.metricRight}>
                    <Text style={styles.metricValue} numberOfLines={1}>
                      {formatValue(r.metric, r.value)}
                    </Text>
                    <Text style={styles.metricSource} numberOfLines={1}>
                      {sourceLabel(r.sourceName)}
                      {r.rawTypeId.includes(':') ? ` · ${t('estimated')}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}

        {records.length > 0 && (
          <TouchableOpacity onPress={clearAll} style={styles.clear}>
            <Text style={styles.clearText}>{t('Clear wearable data')}</Text>
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
  cardTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', flexShrink: 1 },
  okPill: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.ok,
  },
  okPillText: { color: Colors.ok, fontSize: 12, fontWeight: '600' },
  cardText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  syncText: { color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
  warning: { color: Colors.warning, fontSize: 13, lineHeight: 19 },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10 },
  // Texto centrado también cuando ocupa dos líneas (letra grande o botones en fila)
  button: {
    minHeight: 48,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGrow: { flex: 1 },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.accent },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: Colors.background, fontWeight: '700', fontSize: 15, textAlign: 'center' },
  buttonGhostText: { color: Colors.accent },
  message: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 8 },
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  coverLabel: { color: Colors.textPrimary, fontSize: 14, width: 120 },
  coverValue: { color: Colors.textSecondary, fontSize: 13, flex: 1, textAlign: 'right' },
  dayCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  dayTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  metricLabel: { color: Colors.textSecondary, fontSize: 14, flexShrink: 1 },
  metricRight: { alignItems: 'flex-end', flexShrink: 1, maxWidth: '60%' },
  metricValue: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  metricSource: { color: Colors.textMuted, fontSize: 11 },
  clear: { alignSelf: 'center', paddingVertical: 12 },
  clearText: { color: Colors.danger, fontSize: 14 },
});
