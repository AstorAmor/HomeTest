import { dateLocale, num, t } from '@/i18n';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FRow, SecHead, Tag } from '@/components/fine/Fine';
import { FLink } from '@/components/fine/FineForm';
import { SetRow, settingsStyles } from '@/components/settings/SettingsParts';
import { DailyWearableRecord, WearableMetric } from '@/wearables/types';
import { wearableRepository } from '@/wearables/wearableRepository';
import { generateHuaweiDummy } from '@/wearables/providers/huaweiDummy';
import { TAB, tabHref } from '@/constants/tabs';
import { showSamples } from '@/data/dataMode';
import { isSleepDetail, localDayKey, pickPerDay, syncAppleHealthIfDue, syncHealthConnectIfDue } from '@/wearables/dailySeries';
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
import {
  APPLE_READ_TYPES,
  APPLE_TYPE_LABEL,
  appleHealthAsked,
  connectAppleHealth,
  isAppleHealthAvailable,
  lastAppleHealthSync,
  openAppleHealth,
} from '@/wearables/providers/appleHealth';
import { FINE, ff, fine } from '@/theme/fine';

// Wearables en el lenguaje fino desde el 2026-11-17 (el fundador: «En Wearables, mantienes los iconos antiguos y la
// estética antigua»). Antes: tarjetas con borde, un icono de color por fuente y por métrica y botones esmeralda a todo
// el ancho. Ahora, como Ajustes: cabeceras pequeñas, filas con una línea fina y sin iconos. Solo la conexión activa va
// en una caja casi transparente, porque guarda un estado (conectada y cuándo se sincronizó por última vez).

// En iPhone, Apple Salud; en Android, Health Connect; en la web se explican las dos
const IS_IOS = Platform.OS === 'ios';
const SHOW_HC = !IS_IOS;
const SHOW_APPLE = Platform.OS !== 'android';

// Nombre y unidad de cada métrica (sin icono ni color: los días recientes van en filas con línea fina)
const METRIC_LABEL: Record<WearableMetric, { label: string; unit: string }> = {
  steps: { label: 'Steps', unit: '' },
  resting_heart_rate: { label: 'Resting heart rate', unit: 'bpm' },
  heart_rate_avg: { label: 'Average heart rate', unit: 'bpm' },
  hrv: { label: 'HRV', unit: 'ms' },
  sleep_duration: { label: 'Sleep', unit: '' },
  sleep_deep: { label: 'Deep sleep', unit: '' },
  sleep_light: { label: 'Light sleep', unit: '' },
  sleep_rem: { label: 'REM sleep', unit: '' },
  sleep_awake: { label: 'Awake', unit: '' },
  sleep_out_of_bed: { label: 'Out of bed', unit: '' },
  sleep_start: { label: 'Fell asleep', unit: '' },
  sleep_end: { label: 'Woke up', unit: '' },
  active_energy: { label: 'Active energy', unit: 'kcal' },
  body_temperature: { label: 'Body temperature', unit: '°C' },
  distance: { label: 'Distance', unit: 'km' },
  other: { label: 'Other', unit: '' },
};
const METRIC_ORDER: WearableMetric[] = ['steps', 'sleep_duration', 'resting_heart_rate', 'heart_rate_avg', 'hrv', 'active_energy', 'distance', 'body_temperature', 'other'];

// Tipo de Health Connect o de Apple Salud → métrica de Kuova (para el resumen de qué llega)
const TYPE_METRIC: Record<string, WearableMetric> = {
  Steps: 'steps',
  SleepSession: 'sleep_duration',
  RestingHeartRate: 'resting_heart_rate',
  HeartRate: 'heart_rate_avg',
  HeartRateVariabilityRmssd: 'hrv',
  HeartRateVariabilitySDNN: 'hrv',
  ActiveCaloriesBurned: 'active_energy',
  Distance: 'distance',
};

const formatValue = (metric: WearableMetric, value: number) => {
  if (metric === 'sleep_duration') return `${Math.floor(value / 60)}h ${String(Math.round(value % 60)).padStart(2, '0')}m`;
  if (metric === 'steps') return value.toLocaleString(dateLocale());
  if (metric === 'distance') return `${(value / 1000).toLocaleString(dateLocale(), { maximumFractionDigits: 1 })} km`;
  const unit = METRIC_LABEL[metric].unit;
  return unit ? `${num(value)} ${unit}` : num(value);
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

// Píldora esmeralda con su rueda mientras trabaja (Pill no la lleva). `a11y`: lo que oye el lector de pantalla
// («Conectar Apple Salud» y no solo «Conectar»)
function ActionPill({ label, a11y, onPress, busy, disabled }: { label: string; a11y?: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[fine.pill, styles.pill, disabled && !busy && styles.off]}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
    >
      {busy ? <ActivityIndicator size="small" color={FINE.ivory} /> : <Text style={fine.pillText}>{label}</Text>}
    </TouchableOpacity>
  );
}

// La conexión activa: nombre, «Conectado», la última sincronización y las dos acciones (sincronizar y permisos o
// abrir Salud). La píldora y el enlace van uno al lado del otro, nunca uno dentro del otro.
function ConnectedBox({
  name,
  lastSync,
  syncing,
  locked,
  onSync,
  more,
  onMore,
}: {
  name: string;
  lastSync: string | null;
  syncing: boolean;
  locked: boolean; // otra acción en marcha
  onSync: () => void;
  more: string;
  onMore: () => void;
}) {
  return (
    <View style={[fine.tile, styles.box]}>
      <View style={styles.boxHead}>
        <Text style={[fine.rowTitle, styles.flex]} numberOfLines={1}>
          {name}
        </Text>
        <Tag label={t('Connected')} />
      </View>
      <View style={styles.boxRow}>
        <Text style={styles.boxLabel}>{t('Last sync')}</Text>
        <Text style={styles.boxValue}>{lastSync ? timeAgo(lastSync) : t('Not yet')}</Text>
      </View>
      <Text style={styles.boxNote}>{t('Syncs automatically each time Today opens.')}</Text>
      <View style={styles.boxActions}>
        <ActionPill label={t('Sync now')} onPress={onSync} busy={syncing} disabled={locked} />
        <FLink label={more} onPress={onMore} disabled={locked} />
      </View>
    </View>
  );
}

export const WearablesScreen = () => {
  const [records, setRecords] = useState<DailyWearableRecord[]>([]);
  const [hcAvailable, setHcAvailable] = useState<boolean | null>(null);
  const [granted, setGranted] = useState<string[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState<boolean | null>(null);
  const [appleConnected, setAppleConnected] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const samples = showSamples();

  const refresh = useCallback(async () => {
    setRecords(await wearableRepository.getRecords().catch(() => []));
    if (IS_IOS) {
      setAppleConnected(await appleHealthAsked());
      setLastSync(await lastAppleHealthSync());
    } else {
      setGranted(await grantedTypes());
      setLastSync(await lastHealthConnectSync());
    }
  }, []);

  useEffect(() => {
    refresh();
    isHealthConnectAvailable().then(setHcAvailable);
    isAppleHealthAvailable().then(setAppleAvailable);
  }, [refresh]);

  const run = useCallback(async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    setMessage('');
    try {
      setMessage(await fn());
    } catch (err) {
      // t(): los avisos propios («Health Connect is not available on this device.») salen traducidos; el resto, tal cual
      setMessage(err instanceof Error ? t(err.message) : t('Something went wrong'));
    } finally {
      setBusy(null);
    }
  }, []);

  const loadDummy = () =>
    run('dummy', async () => {
      setRecords(await wearableRepository.upsertRecords(generateHuaweiDummy(14)));
      return t('Loaded 14 days of sample Huawei Health data.');
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

  const syncApple = () =>
    run('apple-sync', async () => {
      const changed = await syncAppleHealthIfDue(true);
      await refresh();
      return changed ? t('Synced the last 30 days from Apple Health.') : t('No data found in Apple Health for the last 30 days.');
    });

  // En iPhone, conectar = enseñar la pantalla de permisos de Salud y sincronizar
  const connectApple = () =>
    run('apple-connect', async () => {
      const asked = await connectAppleHealth();
      setAppleConnected(asked);
      if (!asked) return t('No permissions were granted.');
      await syncAppleHealthIfDue(true);
      await refresh();
      return t('Connected. Your data will update every time you open Today.');
    });

  const clearAll = () =>
    run('clear', async () => {
      await wearableRepository.clearRecords();
      setRecords([]);
      return t('Wearable data cleared.');
    });

  // Qué llega de cada tipo en los últimos 30 días: días con dato y de qué apps. Apple Salud no dice qué
  // permisos de lectura hay, así que allí todo cuenta como permitido y lo que falta sale "Sin datos".
  const coverage = useMemo(() => {
    const since = localDayKey(new Date(Date.now() - 29 * 86400000));
    const provider = IS_IOS ? 'apple_health' : 'health_connect';
    const mine = records.filter((r) => r.provider === provider && r.date >= since);
    const types: readonly string[] = IS_IOS ? APPLE_READ_TYPES : readTypes();
    return types.map((type) => {
      const metric = TYPE_METRIC[type];
      const rows = mine.filter((r) => r.metric === metric);
      const sources = new Set<string>();
      rows.forEach((r) => r.sourceName.split(' + ').forEach((s) => sources.add(s)));
      const estimated = type === 'RestingHeartRate' && rows.length > 0 && rows.every((r) => r.rawTypeId.includes(':'));
      return { type, allowed: IS_IOS || granted.includes(type), days: new Set(rows.map((r) => r.date)).size, sources: [...sources], estimated };
    });
  }, [records, granted]);
  const typeLabel = IS_IOS ? APPLE_TYPE_LABEL : TYPE_LABEL;
  const connected = IS_IOS ? appleConnected : granted.length > 0;
  const anyMissing = IS_IOS && connected && coverage.some((c) => c.days === 0);
  const onlyPhone =
    connected && coverage.some((c) => c.days > 0) && coverage.every((c) => c.sources.every((s) => s === PHONE_SOURCE));
  const missingPermissions = connected && coverage.some((c) => !c.allowed);

  // Últimos 7 días con datos, agrupados por fecha (una fuente por métrica y día, la que usa la app).
  // Las fases y horas del sueño se ven en el detalle del sueño; aquí, solo la duración.
  const byDate = useMemo(() => {
    const map = new Map<string, DailyWearableRecord[]>();
    for (const r of pickPerDay(records)) if (!isSleepDetail(r.metric)) map.set(r.date, [...(map.get(r.date) ?? []), r]);
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7)
      .map(([date, rows]) => [date, rows.sort((a, b) => METRIC_ORDER.indexOf(a.metric) - METRIC_ORDER.indexOf(b.metric))] as const);
  }, [records]);

  const locked = busy !== null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Wearables')} showBack backFallback={tabHref(TAB.you)} />

        <View style={settingsStyles.body}>
          {/* Conexiones: la activa en su caja; las demás, filas con su explicación y «Conectar» a la derecha */}
          <SecHead title={t('Connections')} style={settingsStyles.firstSec} />

          {SHOW_APPLE &&
            (appleAvailable !== false && connected ? (
              <ConnectedBox
                name={t('Apple Health')}
                lastSync={lastSync}
                syncing={busy === 'apple-sync'}
                locked={locked}
                onSync={syncApple}
                more={t('Open Health')}
                onMore={openAppleHealth}
              />
            ) : (
              <SetRow
                title={t('Apple Health')}
                sub={t('Apple Watch and the apps that write to Health on your iPhone: Oura, Garmin, WHOOP, Huawei Health and others.')}
                right={
                  appleAvailable === false ? undefined : (
                    <ActionPill
                      label={t('Connect')}
                      a11y={t('Connect Apple Health')}
                      onPress={connectApple}
                      busy={busy === 'apple-connect'}
                      disabled={locked || !appleAvailable}
                    />
                  )
                }
              >
                {appleAvailable === false ? (
                  <Text style={styles.rowNote}>{t('Apple Health only works in the Kuova app for iPhone (not in the browser or Expo Go).')}</Text>
                ) : null}
              </SetRow>
            ))}

          {SHOW_HC &&
            (hcAvailable !== false && connected ? (
              <ConnectedBox
                name={t('Health Connect')}
                lastSync={lastSync}
                syncing={busy === 'hc-sync'}
                locked={locked}
                onSync={sync}
                more={t('Permissions')}
                onMore={openHealthConnectSettings}
              />
            ) : (
              <SetRow
                title={t('Health Connect')}
                sub={t('Fitbit, Xiaomi, Garmin, Oura, Samsung, Google and others that sync to Health Connect.')}
                right={
                  hcAvailable === false ? undefined : (
                    <ActionPill
                      label={t('Connect')}
                      a11y={t('Connect Health Connect')}
                      onPress={connect}
                      busy={busy === 'hc-connect'}
                      disabled={locked || !hcAvailable}
                    />
                  )
                }
              >
                {hcAvailable === false ? (
                  <Text style={styles.rowNote}>{t('Health Connect only works in the Kuova app for Android (not in the browser or Expo Go).')}</Text>
                ) : null}
              </SetRow>
            ))}

          {/* Huawei Health: sin conexión directa todavía; en la demo, datos de ejemplo con la forma que enviará */}
          <SetRow
            title={t('Huawei Health')}
            sub={
              samples
                ? t('Direct connection coming soon. Until then, load test data with the same shape Huawei will send.')
                : IS_IOS
                  ? t('On iPhone, Huawei Health can share with Apple Health: turn it on in the Huawei Health app and Kuova reads it from there.')
                  : t('Direct connection coming soon. Huawei Health does not share with Health Connect yet.')
            }
            last
          >
            {samples ? (
              <FLink
                label={t('Load sample Huawei data')}
                onPress={loadDummy}
                busy={busy === 'dummy'}
                disabled={locked}
                style={[settingsStyles.linkLeft, styles.inlineLink]}
              />
            ) : null}
          </SetRow>

          {message ? (
            <Text style={styles.message} accessibilityLiveRegion="polite">
              {message}
            </Text>
          ) : null}

          {/* Qué llega de cada tipo: días con dato y de qué apps; a la derecha, los días o por qué no llega */}
          {connected && (
            <>
              <SecHead title={t('Data received · 30 days')} />
              {coverage.map((c, i) => {
                const arriving = c.allowed && c.days > 0;
                return (
                  <FRow
                    key={c.type}
                    title={t(typeLabel[c.type])}
                    sub={arriving ? `${sourceLabel(c.sources)}${c.estimated ? ` · ${t('estimated from heart rate')}` : ''}` : undefined}
                    right={
                      <Text style={[fine.rowValue, !arriving && styles.muted]} numberOfLines={1}>
                        {!c.allowed ? t('No permission') : c.days ? t(c.days === 1 ? '{n} day' : '{n} days', { n: c.days }) : t('No data')}
                      </Text>
                    }
                    last={i === coverage.length - 1}
                  />
                );
              })}
              {onlyPhone && (
                <Text style={fine.note}>
                  {IS_IOS
                    ? t('Only the iPhone is sending data. For a watch or ring, turn on sharing with Apple Health in its app (Oura, Garmin Connect, WHOOP, Huawei Health…), then sync.')
                    : t('Only the phone is sending data (steps). For a watch, turn on sharing with Health Connect in its app (Fitbit, Mi Fitness, Samsung Health…), then sync.')}
                </Text>
              )}
              {anyMissing && (
                <Text style={fine.note}>
                  {t('Types with no data: allow them in Health → your photo → Apps → Kuova, and check that the watch or ring app writes them to Health.')}
                </Text>
              )}
              {missingPermissions && (
                <>
                  <Text style={fine.note}>{t('Types without permission are not read.')}</Text>
                  <FLink
                    label={t('Allow the missing ones')}
                    onPress={connect}
                    busy={busy === 'hc-connect'}
                    disabled={locked}
                    style={settingsStyles.linkLeft}
                  />
                </>
              )}
            </>
          )}

          {/* Los últimos 7 días con datos: la fecha pequeña y, debajo, una fila por métrica con su valor y su fuente */}
          <SecHead title={t('Recent days')} />
          {byDate.length === 0 ? (
            <Text style={fine.note}>{t('No wearable data yet.')}</Text>
          ) : (
            byDate.map(([date, rows], di) => (
              <View key={date}>
                <Text style={[styles.dayTitle, di === 0 && styles.dayFirst]}>{formatDate(date)}</Text>
                {rows.map((r, i) => (
                  <View
                    key={`${r.metric}|${r.sourceName}|${r.rawTypeId}`}
                    style={[styles.metricRow, di === byDate.length - 1 && i === rows.length - 1 && styles.noLine]}
                  >
                    <Text style={styles.metricLabel} numberOfLines={1}>
                      {t(METRIC_LABEL[r.metric].label)}
                    </Text>
                    <View style={styles.metricRight}>
                      <Text style={fine.rowValue} numberOfLines={1}>
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

          {/* Borrar: un enlace apagado, sin rojo (como «Cerrar sesión» en Ajustes) */}
          {records.length > 0 && (
            <FLink label={t('Clear wearable data')} onPress={clearAll} muted busy={busy === 'clear'} disabled={locked} style={styles.clear} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0 },
  off: { opacity: 0.45 },
  muted: { color: FINE.mute },
  // La píldora no cambia de ancho al salir la rueda
  pill: { minWidth: 96, paddingHorizontal: 16 },
  // Debajo de la explicación de una fila: dónde funciona, o el enlace de los datos de ejemplo
  rowNote: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 17, marginTop: 6 },
  inlineLink: { marginTop: 2, minHeight: 36, paddingVertical: 6 },
  // La caja de la conexión activa: casi transparente, con borde jade
  box: { borderColor: FINE.jadeLine, padding: 14, marginTop: 4, marginBottom: 4 },
  boxHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  boxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: FINE.line,
  },
  boxLabel: { ...ff('regular'), color: FINE.mute, fontSize: 13, flex: 1 },
  boxValue: { ...ff('regular'), color: FINE.ivory, fontSize: 13, fontVariant: ['tabular-nums'] },
  boxNote: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 17, marginTop: 8 },
  boxActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18, marginTop: 10 },
  message: { ...ff('regular'), color: FINE.ivory, fontSize: 13, lineHeight: 18, marginTop: 12 },
  // Días recientes: la fecha pequeña en mayúsculas y las métricas en filas con línea fina
  dayTitle: { ...fine.kicker, marginTop: 18, marginBottom: 2 },
  dayFirst: { marginTop: 4 },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    minHeight: 46,
    borderBottomWidth: 1,
    borderBottomColor: FINE.line,
  },
  metricLabel: { ...ff('regular'), color: FINE.ivory, fontSize: 14, flexShrink: 1 },
  metricRight: { alignItems: 'flex-end', flexShrink: 1, maxWidth: '60%' },
  metricSource: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, lineHeight: 15, marginTop: 1 },
  noLine: { borderBottomWidth: 0 },
  clear: { marginTop: 24 },
});
