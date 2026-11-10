import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { t } from '@/i18n';
import { BIOMARKER_CATEGORY_LABELS } from '@/utils/biomarkerLabels';
import { PanelMarker, panelCounts, subscriptionPanelMarkers } from '@/data/subscriptionPanel';

type Filter = 'all' | 'premium' | 'followUp';
const FILTERS: Filter[] = ['all', 'premium', 'followUp'];

// Qué mide cada analítica de la suscripción, en tres columnas: el análisis anual de Basic (Kuova Baseline),
// el de Premium (Kuova Premium) y el seguimiento, que es el mismo en los dos (cada 6 meses en Basic, cada 3
// en Premium). Composición en src/data/subscriptionPanel.ts. Se abre desde las fichas de las suscripciones
// (?plan=premium empieza en «Lo que añade Premium») y desde «Comparar suscripciones».
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
  const check = <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />;
  const dash = <Text style={styles.dash}>–</Text>;
  const year1 = <Text style={styles.firstYear}>{t('Year 1')}</Text>;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('What each analysis measures')} showBack backFallback="/store" />
        <Text style={styles.intro}>
          {t('The yearly Kuova Baseline analysis (Basic) has 31 lab tests and the Kuova Premium one has 42: everything in Basic plus the full thyroid, your hormones, folic acid and albumin in urine. Both add Lp(a) the first year. The follow-up is the same 23 tests for both: every 6 months with Basic and every 3 months with Premium. Counting each value of the blood count and the urine test, and the calculated indices, these are the markers.')}
        </Text>

        <View style={styles.summary}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryNum}>{counts.basic}</Text>
            <Text style={styles.summaryLabel}>{t('Basic yearly')}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryNum}>{counts.premium}</Text>
            <Text style={styles.summaryLabel}>{t('Premium yearly')}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryNum}>{counts.followUp}</Text>
            <Text style={styles.summaryLabel}>{t('Follow-up')}</Text>
          </View>
        </View>

        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <TouchableOpacity key={f} style={[styles.filter, filter === f && styles.filterOn]} onPress={() => setFilter(f)}>
              <Text style={[styles.filterText, filter === f && styles.filterTextOn]} numberOfLines={1}>
                {f === 'all' ? t('Everything') : f === 'premium' ? t('Premium only') : t('Follow-up')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.colHead}>
          <Text style={[styles.colHeadText, styles.colHeadName]}>{t('Marker')}</Text>
          {['Basic', 'Premium', t('Follow-up')].map((label) => (
            <Text key={label} style={styles.colHeadText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              {label}
            </Text>
          ))}
        </View>

        {sections.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            {s.data.map((m) => (
              <View key={m.id} style={styles.row}>
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

        <Text style={styles.footnote}>
          {t('Indicative list: the final panel is confirmed with our partner laboratory.')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const CELL = 64;
const PAD = 12; // relleno de las tarjetas; la cabecera suma el borde (1) para quedar alineada

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginBottom: 14 },
  summary: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 14 },
  summaryBox: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  summaryNum: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800' },
  summaryLabel: { color: Colors.textSecondary, fontSize: 12, marginTop: 2, textAlign: 'center' },
  filters: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginBottom: 14 },
  filter: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 7,
  },
  filterOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  filterTextOn: { color: Colors.background },
  colHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingHorizontal: PAD + 1,
    paddingBottom: 6,
  },
  colHeadText: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', width: CELL, textAlign: 'center' },
  colHeadName: { flex: 1, width: undefined, textAlign: 'left' },
  section: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: PAD,
    paddingVertical: 8,
  },
  sectionTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800', paddingVertical: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  nameCol: { flex: 1, paddingRight: 6 },
  name: { color: Colors.textPrimary, fontSize: 14 },
  calc: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  cell: { width: CELL, alignItems: 'center' },
  dash: { color: Colors.textMuted, fontSize: 16 },
  firstYear: { color: Colors.accent, fontSize: 11, fontWeight: '800' },
  footnote: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', paddingHorizontal: 30, marginTop: 8, lineHeight: 16 },
});
