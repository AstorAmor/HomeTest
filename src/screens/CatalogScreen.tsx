import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, SectionList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { getAllCanonicalBiomarkers } from '@/knowledge/canonicalBiomarkers';
import { CanonicalBiomarker, MeasurementType } from '@/types/knowledge';

// Etiquetas legibles para las categorias provisionales de knowledge/biomarcadores/*.json.
const CATEGORY_LABELS: Record<string, string> = {
  metabolico: 'Metabolic',
  lipidico: 'Heart & Lipids',
  renal: 'Kidneys',
  hepatico: 'Liver',
  electrolitos: 'Electrolytes',
  hematologia: 'Blood',
  endocrino: 'Stress & Aging',
  vitales: 'Vitals',
  tiroides: 'Thyroid',
  autoinmunidad: 'Autoimmunity',
  regulacion_inmune: 'Immune Regulation',
  hormonas: 'Hormones',
  salud_femenina: 'Female Health',
  salud_masculina: 'Male Health',
  toxinas_ambientales: 'Environmental Toxins',
  nutrientes: 'Nutrients',
  pancreas: 'Pancreas',
  orina: 'Urine',
  edad_biologica: 'Biological Age',
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
  const haystack = [biomarker.canonical_name, biomarker.canonical_id, ...biomarker.aliases]
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
        title: CATEGORY_LABELS[category] ?? category,
        data: [...data].sort((a, b) => a.canonical_name.localeCompare(b.canonical_name)),
      }));

    return { sections: built, total: filtered.length };
  }, [query]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Biomarker Catalog" showBack />

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search biomarker..."
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <Text style={styles.count}>{total} biomarkers</Text>

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
        ListEmptyComponent={<Text style={styles.empty}>No matches for “{query}”.</Text>}
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
  const hasFunction = biomarker.external_sources.some((s) => s.source === 'FUNCTION_HEALTH');

  return (
    <TouchableOpacity style={styles.card} onPress={onToggle} activeOpacity={0.8}>
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={expanded ? undefined : 1}>
          {biomarker.canonical_name}
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
            {biomarker.measurement_type}
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeTextMuted}>{biomarker.evidence_status}</Text>
        </View>
        {hasFunction && (
          <View style={[styles.badge, styles.badgeOutline]}>
            <Text style={styles.badgeTextMuted}>Function Health</Text>
          </View>
        )}
      </View>

      {expanded && (
        <View style={styles.detail}>
          <DetailRow label="ID" value={biomarker.canonical_id} />
          {biomarker.aliases.length > 0 && (
            <DetailRow label="Aliases" value={biomarker.aliases.join(', ')} />
          )}
          <DetailRow label="Sample" value={biomarker.sample_type} />
          {biomarker.common_units.length > 0 && (
            <DetailRow label="Units" value={biomarker.common_units.join(', ')} />
          )}

          <Text style={styles.knowledgeText}>
            {biomarker.knowledge_card.biological_role ??
              'Not reviewed yet — no verified medical content for this biomarker.'}
          </Text>

          {biomarker.knowledge_card.limitations && (
            <Text style={styles.limitationsText}>⚠ {biomarker.knowledge_card.limitations}</Text>
          )}

          {biomarker.external_sources.map((source, i) => (
            <Text key={i} style={styles.sourceText}>
              {source.source}: “{source.external_name}” · {source.external_category ?? '—'} ·{' '}
              {source.included_or_addon ?? '—'}
            </Text>
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
