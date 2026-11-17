import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, SectionList, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formStyles } from '@/components/fine/FineForm';
import { getAllCanonicalBiomarkers } from '@/knowledge/canonicalBiomarkers';
import { getBiomarkerCodes } from '@/knowledge/standardCodes';
import { CanonicalBiomarker, MeasurementType } from '@/types/knowledge';
import { getLang, t } from '@/i18n';
import { catalogCardEs } from '@/i18n/catalogEs';
import { BIOMARKER_CATEGORY_LABELS, biomarkerDisplayName } from '@/utils/biomarkerLabels';
import { TAB, tabHref } from '@/constants/tabs';
import { FINE, ff, fine } from '@/theme/fine';

// Los datos de knowledge/ tienen nombres en español (canonical_name) e inglés (canonical_name_en);
// la muestra y alguna unidad vienen en español: aquí se muestran en el idioma de la app.
// En el lenguaje fino (src/theme/fine.ts) desde el 2026-11-17: la búsqueda en una casilla casi transparente, cada
// categoría con su nombre pequeño en versalitas y cada biomarcador en una fila con una línea fina; abierta, sus datos
// en filas de dos columnas y las fichas con su título pequeño. Sin etiquetas de color ni emojis: el tipo de medida va
// en gris debajo del nombre, las limitaciones en oro y las referencias apagadas y subrayadas.
const SAMPLE_EN: Record<string, string> = {
  Sangre: 'Blood',
  Orina: 'Urine',
  'Tensiómetro': 'Blood pressure monitor',
  'N/A (calculado)': 'Calculated',
};
const UNIT_EN: Record<string, string> = { años: 'years' };

const es = () => getLang() === 'es';
const displayName = biomarkerDisplayName;
const CATEGORY_LABELS = BIOMARKER_CATEGORY_LABELS;
const sampleName = (s: string) => (es() ? s.replace('N/A (calculado)', 'Calculado') : SAMPLE_EN[s] ?? s);
const unitName = (u: string) => (es() ? u : UNIT_EN[u] ?? u);
const MEASUREMENT_LABEL: Record<MeasurementType, string> = {
  MEASURED: 'Measured',
  DERIVED: 'Calculated',
  SCORE: 'Score',
  UNKNOWN: 'Other',
};

interface Section {
  title: string;
  data: CanonicalBiomarker[];
}

function matchesQuery(biomarker: CanonicalBiomarker, query: string): boolean {
  if (!query) return true;
  const haystack = [displayName(biomarker), biomarker.canonical_name, biomarker.canonical_id, ...biomarker.aliases]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

export const CatalogScreen = () => {
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { sections, total } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = getAllCanonicalBiomarkers().filter((b) => matchesQuery(b, q));

    const byCategory = new Map<string, CanonicalBiomarker[]>();
    for (const biomarker of filtered) {
      const list = byCategory.get(biomarker.category) ?? [];
      list.push(biomarker);
      byCategory.set(biomarker.category, list);
    }

    const built: Section[] = Array.from(byCategory.entries())
      .sort((a, b) => (CATEGORY_LABELS[a[0]] ?? a[0]).localeCompare(CATEGORY_LABELS[b[0]] ?? b[0]))
      .map(([category, data]) => ({
        title: t(CATEGORY_LABELS[category] ?? category),
        data: [...data].sort((a, b) => displayName(a).localeCompare(displayName(b))),
      }));

    return { sections: built, total: filtered.length };
  }, [query]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title={t('Biomarker Catalog')} showBack backFallback={tabHref(TAB.you)} />

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={15} color={FINE.mute} style={styles.searchIcon} />
        <TextInput
          style={[formStyles.input, styles.searchInput]}
          placeholder={t('Search biomarker...')}
          placeholderTextColor={FINE.mute}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={t('Search biomarker...')}
        />
      </View>

      <Text style={styles.count}>{t('{n} biomarkers', { n: total })}</Text>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.canonical_id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader} accessibilityRole="header">
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <BiomarkerRow
            biomarker={item}
            expanded={expandedId === item.canonical_id}
            onToggle={() => setExpandedId((id) => (id === item.canonical_id ? null : item.canonical_id))}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t('No matches for “{q}”.', { q: query })}</Text>}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

interface BiomarkerRowProps {
  biomarker: CanonicalBiomarker;
  expanded: boolean;
  onToggle: () => void;
}

// La fila de un biomarcador: el nombre y el tipo de medida se tocan para abrir; lo de dentro (las referencias, que se
// abren) va aparte, para que no quede un botón dentro de otro
const BiomarkerRow = ({ biomarker, expanded, onToggle }: BiomarkerRowProps) => {
  const card = es() ? { ...biomarker.knowledge_card, ...catalogCardEs[biomarker.canonical_id] } : biomarker.knowledge_card;
  const codes = getBiomarkerCodes(biomarker.canonical_id);

  return (
    <View style={styles.item}>
      <TouchableOpacity style={styles.topRow} onPress={onToggle} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ expanded }}>
        <View style={styles.flex}>
          <Text style={fine.rowTitle} numberOfLines={expanded ? undefined : 1}>
            {displayName(biomarker)}
          </Text>
          <Text style={fine.rowSub}>{t(MEASUREMENT_LABEL[biomarker.measurement_type])}</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={FINE.mute} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.detail}>
          <DetailRow label="ID" value={biomarker.canonical_id} />
          {biomarker.aliases.length > 0 && <DetailRow label={t('Also known as')} value={biomarker.aliases.join(', ')} />}
          <DetailRow label={t('Sample')} value={sampleName(biomarker.sample_type)} />
          {biomarker.common_units.length > 0 && <DetailRow label={t('Units')} value={biomarker.common_units.map(unitName).join(', ')} />}
          <DetailRow label="LOINC" value={codes?.loinc ? `${codes.loinc} · ${codes.loinc_display}` : t('Pending')} />
          {codes?.ucum ? <DetailRow label="UCUM" value={codes.ucum} /> : null}

          {card.biological_role ? (
            <>
              <Text style={styles.kTitle}>{t('What it is')}</Text>
              <Text style={styles.knowledgeText}>{card.biological_role}</Text>
              <Text style={styles.kTitle}>{t('Why it matters')}</Text>
              <Text style={styles.knowledgeText}>{card.clinical_relevance}</Text>
              <Text style={styles.kTitle}>{t('What can change it')}</Text>
              <Text style={styles.knowledgeText}>{card.preanalytical_factors}</Text>
            </>
          ) : (
            <Text style={[styles.knowledgeText, styles.gap]}>{t('No information for this biomarker yet.')}</Text>
          )}

          {/* Lo que limita la lectura, en oro y sin el símbolo de aviso */}
          {card.limitations ? <Text style={[formStyles.warn, styles.gap]}>{card.limitations}</Text> : null}

          {(biomarker.knowledge_card.references ?? []).map((r) => (
            <TouchableOpacity key={r.url} onPress={() => Linking.openURL(r.url)} accessibilityRole="link">
              <Text style={styles.refText}>{r.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

// Un dato de la ficha: el nombre apagado a la izquierda y el valor a la derecha
const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1, minWidth: 0 },
  searchWrap: { marginHorizontal: 20, marginTop: 4, justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  searchInput: { paddingLeft: 34 },
  count: { ...ff('regular'), color: FINE.mute, fontSize: 12, marginHorizontal: 20, marginTop: 10, marginBottom: 4 },
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  sectionHeader: { ...fine.secTitle, marginTop: 22, marginBottom: 2 },
  empty: { ...ff('regular'), color: FINE.mute, fontSize: 13, textAlign: 'center', marginTop: 40 },
  item: { borderBottomWidth: 1, borderBottomColor: FINE.line },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, minHeight: 50 },
  detail: { paddingBottom: 14 },
  detailRow: { flexDirection: 'row', gap: 12, paddingVertical: 5 },
  detailLabel: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 17, width: 104 },
  detailValue: { ...ff('regular'), color: FINE.ivory, fontSize: 12.5, lineHeight: 17, flex: 1 },
  kTitle: { ...fine.kicker, marginTop: 14, marginBottom: 3 },
  knowledgeText: { ...ff('regular'), color: '#CFD6CF', fontSize: 13, lineHeight: 18 },
  gap: { marginTop: 12 },
  refText: { ...ff('regular'), color: FINE.mute, fontSize: 12, lineHeight: 16, marginTop: 10, textDecorationLine: 'underline' },
});
