import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, SectionList, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { getAllCanonicalBiomarkers } from '@/knowledge/canonicalBiomarkers';
import { getBiomarkerCodes } from '@/knowledge/standardCodes';
import { CanonicalBiomarker, MeasurementType } from '@/types/knowledge';
import { getLang, t } from '@/i18n';
import { catalogCardEs } from '@/i18n/catalogEs';
import { BIOMARKER_CATEGORY_LABELS, biomarkerDisplayName } from '@/utils/biomarkerLabels';

// Los datos de knowledge/ tienen nombres en español (canonical_name) e inglés (canonical_name_en);
// la muestra y alguna unidad vienen en español: aquí se muestran en el idioma de la app.
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

const MEASUREMENT_COLOR: Record<MeasurementType, string> = {
  MEASURED: Colors.accent,
  DERIVED: Colors.warning,
  SCORE: Colors.pulseAccent,
  UNKNOWN: Colors.textMuted,
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
      <ScreenHeader title={t('Biomarker Catalog')} showBack />

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('Search biomarker...')}
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <Text style={styles.count}>{t('{n} biomarkers', { n: total })}</Text>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.canonical_id}
        contentContainerStyle={styles.listContent}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <BiomarkerRow
            biomarker={item}
            expanded={expandedId === item.canonical_id}
            onToggle={() =>
              setExpandedId((id) => (id === item.canonical_id ? null : item.canonical_id))
            }
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t('No matches for “{q}”.', { q: query })}</Text>}
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

const BiomarkerRow = ({ biomarker, expanded, onToggle }: BiomarkerRowProps) => {
  const measurementColor = MEASUREMENT_COLOR[biomarker.measurement_type];
  const card = es() ? { ...biomarker.knowledge_card, ...catalogCardEs[biomarker.canonical_id] } : biomarker.knowledge_card;

  return (
    <TouchableOpacity style={styles.card} onPress={onToggle} activeOpacity={0.8}>
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={expanded ? undefined : 1}>
          {displayName(biomarker)}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={Colors.textMuted}
        />
      </View>

      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: `${measurementColor}22` }]}>
          <Text style={[styles.badgeText, { color: measurementColor }]}>
            {t(MEASUREMENT_LABEL[biomarker.measurement_type])}
          </Text>
        </View>
      </View>

      {expanded && (
        <View style={styles.detail}>
          <DetailRow label="ID" value={biomarker.canonical_id} />
          {biomarker.aliases.length > 0 && (
            <DetailRow label={t('Also known as')} value={biomarker.aliases.join(', ')} />
          )}
          <DetailRow label={t('Sample')} value={sampleName(biomarker.sample_type)} />
          {biomarker.common_units.length > 0 && (
            <DetailRow label={t('Units')} value={biomarker.common_units.map(unitName).join(', ')} />
          )}
          <DetailRow
            label="LOINC"
            value={(() => {
              const codes = getBiomarkerCodes(biomarker.canonical_id);
              return codes?.loinc ? `${codes.loinc} · ${codes.loinc_display}` : t('Pending');
            })()}
          />
          {getBiomarkerCodes(biomarker.canonical_id)?.ucum ? (
            <DetailRow label="UCUM" value={getBiomarkerCodes(biomarker.canonical_id)!.ucum!} />
          ) : null}

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
            <Text style={styles.knowledgeText}>{t('No information for this biomarker yet.')}</Text>
          )}

          {card.limitations && <Text style={styles.limitationsText}>⚠ {card.limitations}</Text>}

          {(biomarker.knowledge_card.references ?? []).map((r) => (
            <TouchableOpacity key={r.url} onPress={() => Linking.openURL(r.url)}>
              <Text style={styles.refText}>
                📖 {r.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <Text style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}: </Text>
    {value}
  </Text>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  count: {
    color: Colors.textMuted,
    fontSize: 12,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  sectionHeader: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 8,
  },
  empty: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 40,
  },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.backgroundElevated,
  },
  badgeOutline: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: 'transparent',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextMuted: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  detail: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: 6,
  },
  detailRow: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  detailLabel: {
    color: Colors.textMuted,
    fontWeight: '700',
  },
  kTitle: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },
  refText: {
    color: Colors.accent,
    fontSize: 12,
    marginTop: 8,
    textDecorationLine: 'underline',
  },
  reviewText: {
    color: Colors.warning,
    fontSize: 11,
    marginTop: 6,
  },
  knowledgeText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  limitationsText: {
    color: Colors.warning,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  sourceText: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
});
