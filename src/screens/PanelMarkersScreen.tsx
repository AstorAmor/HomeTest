import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { CHECK_PATH } from '@/components/PlanComparison';
import { FChips } from '@/components/fine/FineForm';
import { PathIcon } from '@/components/fine/RoleEmblem';
import { t } from '@/i18n';
import { BIOMARKER_CATEGORY_LABELS } from '@/utils/biomarkerLabels';
import { PanelMarker, panelCounts, subscriptionPanelMarkers } from '@/data/subscriptionPanel';
import { FINE, ff, fine } from '@/theme/fine';

type Filter = 'all' | 'premium' | 'followUp';
const FILTERS: Filter[] = ['all', 'premium', 'followUp'];

// Qué mide cada analítica de la suscripción, en tres columnas: el análisis anual de Basic (Kuova Baseline),
// el de Premium (Kuova Premium) y el seguimiento, que es el mismo en los dos (cada 6 meses en Basic, cada 3
// en Premium). Composición en src/data/subscriptionPanel.ts. Se abre desde las fichas de las suscripciones
// (?plan=premium empieza en «Lo que añade Premium») y desde «Comparar suscripciones».
// En el lenguaje fino (src/theme/fine.ts) desde el 2026-11-17: los recuentos como cifras grandes y ligeras, los
// filtros en chips con borde, cada grupo con su nombre pequeño en versalitas y los marcadores en filas con una línea
// fina, sin tarjetas. Las marcas, a línea y de un solo color, con las tres columnas del mismo ancho.
export const PanelMarkersScreen = () => {
  const { plan } = useLocalSearchParams<{ plan?: string }>();
  const [filter, setFilter] = useState<Filter>(plan === 'premium' ? 'premium' : 'all');
  const all = useMemo(subscriptionPanelMarkers, []);
  const counts = panelCounts(all);

  const sections = useMemo(() => {
    const list = filter === 'all' ? all : all.filter((m) => m.when === (filter === 'premium' ? 'premium' : 'both'));
    const byCategory = new Map<string, PanelMarker[]>();
    for (const m of list) byCategory.set(m.category, [...(byCategory.get(m.category) ?? []), m]);
    return [...byCategory.entries()]
      .map(([category, data]) => ({
        title: t(BIOMARKER_CATEGORY_LABELS[category] ?? category),
        data: [...data].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [all, filter]);

  // Un solo color para todas las marcas, y las tres columnas del mismo ancho: las marcas quedan a la misma distancia
  const check = <PathIcon d={CHECK_PATH} size={17} stroke={1.5} color={FINE.jade} />;
  const dash = <View style={styles.dash} />;
  const year1 = <Text style={styles.firstYear}>{t('Year 1')}</Text>;

  const summary: [number, string][] = [
    [counts.basic, t('Basic yearly')],
    [counts.premium, t('Premium yearly')],
    [counts.followUp, t('Follow-up')],
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('What each analysis measures')} showBack backFallback="/store" />
        <View style={styles.pad}>
          <Text style={styles.intro}>
            {t('The yearly Kuova Baseline analysis (Basic) has 31 lab tests and the Kuova Premium one has 42: everything in Basic plus the full thyroid, your hormones, folic acid and albumin in urine. Both add Lp(a) the first year. The follow-up is the same 23 tests for both: every 6 months with Basic and every 3 months with Premium. Counting each value of the blood count and the urine test, and the calculated indices, these are the markers.')}
          </Text>

          {/* Los tres recuentos: la cifra grande y ligera con su nombre debajo, separados por una línea fina */}
          <View style={styles.summary}>
            {summary.map(([n, label], i) => (
              <View key={label} style={[styles.summaryCol, i > 0 && styles.summarySep]}>
                <Text style={styles.summaryNum}>{n}</Text>
                <Text style={styles.summaryLabel}>{label}</Text>
              </View>
            ))}
          </View>

          <FChips
            options={FILTERS.map((f) => ({ id: f, label: f === 'all' ? t('Everything') : f === 'premium' ? t('Premium only') : t('Follow-up') }))}
            value={filter}
            onChange={setFilter}
            style={styles.filters}
          />

          <View style={styles.colHead}>
            <Text style={[styles.colHeadText, styles.colHeadName]}>{t('Marker')}</Text>
            {['Basic', 'Premium', t('Follow-up')].map((label) => (
              <Text key={label} style={styles.colHeadText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                {label}
              </Text>
            ))}
          </View>

          {sections.map((s) => (
            <View key={s.title}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {s.title}
              </Text>
              {s.data.map((m, i) => (
                <View key={m.id} style={[styles.row, i === s.data.length - 1 && styles.lastRow]}>
                  <View style={styles.nameCol}>
                    <Text style={styles.name}>{m.name}</Text>
                    {m.calculated && <Text style={styles.calc}>{t('Calculated from other values')}</Text>}
                    {m.only === 'female' && <Text style={styles.calc}>{t('Women only')}</Text>}
                    {m.only === 'male' && <Text style={styles.calc}>{t('Men aged 50 or over, if they choose it')}</Text>}
                  </View>
                  <View style={styles.cell}>{m.when === 'premium' ? dash : m.when === 'firstYear' ? year1 : check}</View>
                  <View style={styles.cell}>{m.when === 'firstYear' ? year1 : check}</View>
                  <View style={styles.cell}>{m.when === 'both' ? check : dash}</View>
                </View>
              ))}
            </View>
          ))}

          <Text style={styles.footnote}>{t('Indicative list: the final panel is confirmed with our partner laboratory.')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const CELL = 64;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  pad: { paddingHorizontal: 20 },
  intro: { ...fine.note, fontSize: 13.5, lineHeight: 19, marginTop: 0 },
  summary: { flexDirection: 'row', marginTop: 18, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: FINE.line },
  summaryCol: { flex: 1, paddingHorizontal: 4 },
  summarySep: { borderLeftWidth: 1, borderLeftColor: FINE.line, paddingLeft: 12 },
  summaryNum: { ...fine.num, fontSize: 30, lineHeight: 36 },
  summaryLabel: { ...ff('regular'), color: FINE.mute, fontSize: 12, lineHeight: 16, marginTop: 2 },
  filters: { marginTop: 18, marginBottom: 18 },
  colHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: FINE.rule },
  colHeadText: { ...ff('regular'), color: FINE.mute, fontSize: 11, width: CELL, textAlign: 'center' },
  colHeadName: { flex: 1, width: undefined, textAlign: 'left' },
  sectionTitle: { ...fine.secTitle, marginTop: 20, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: FINE.line },
  lastRow: { borderBottomWidth: 0 },
  nameCol: { flex: 1, minWidth: 0, paddingRight: 6 },
  name: { ...ff('regular'), color: FINE.ivory, fontSize: 14, lineHeight: 19 },
  calc: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, lineHeight: 15, marginTop: 1 },
  cell: { width: CELL, alignItems: 'center', justifyContent: 'center' },
  dash: { width: 10, height: 1, backgroundColor: FINE.mute, opacity: 0.6 },
  firstYear: { ...ff('regular'), color: FINE.jade, fontSize: 11 },
  footnote: { ...fine.note, fontSize: 11.5, lineHeight: 16, marginTop: 20 },
});
