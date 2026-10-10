import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { useProIdentity } from '@/components/pro/ProLayout';
import { ProTemplate, TemplateTopic, fillTemplate, suggestTemplates, templateTopicIcon, templateTopicName, templates } from '@/data/proTemplates';

import { t as tr } from '@/i18n';
interface Props {
  question: string; // texto del paciente: de aquí salen las sugerencias
  patientName: string;
  extraTopic?: TemplateTopic; // p. ej. "Review my results" → analíticas
  onInsert: (text: string) => void;
  startOpen?: boolean;
}

// Fila "Templates" al contestar: hasta 3 sugeridas por la pregunta y "Browse all" con buscador.
// Insertar rellena [name] y [doctor]; el resto de huecos [ ] los completa el médico.
export const TemplatePicker = ({ question, patientName, extraTopic, onInsert, startOpen }: Props) => {
  const router = useRouter();
  const me = useProIdentity();
  const [list, setList] = useState<ProTemplate[] | null>(null);
  const [open, setOpen] = useState(!!startOpen);
  const [query, setQuery] = useState('');

  useEffect(() => {
    templates.list().then(setList).catch(() => setList([]));
  }, []);

  const suggested = useMemo(() => (list ? suggestTemplates(question, list, 3, extraTopic) : []), [list, question, extraTopic]);

  const shown = useMemo(() => {
    if (!list) return [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) => `${t.title} ${templateTopicName(t)} ${t.keywords.join(' ')} ${t.body}`.toLowerCase().includes(q));
  }, [list, query]);

  const insert = (t: ProTemplate) => {
    onInsert(fillTemplate(t.body, { patientName, doctorName: me.name }));
    templates.markUsed(t).catch(() => undefined);
    setOpen(false);
    setQuery('');
  };

  if (!list) return null;

  if (list.length === 0) {
    return (
      <TouchableOpacity style={styles.emptyRow} onPress={() => router.push('/pro-templates')}>
        <Ionicons name="documents-outline" size={15} color={Colors.accent} />
        <Text style={styles.emptyText}>{tr('Save the answers you repeat as templates and insert them here')}</Text>
        <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        <Ionicons name="documents-outline" size={15} color={Colors.textSecondary} />
        <Text style={styles.label}>{suggested.length ? tr('Suggested') : tr('Templates')}</Text>
        {suggested.map((t) => (
          <TouchableOpacity key={t.id} style={styles.chip} onPress={() => insert(t)}>
            <Ionicons name={templateTopicIcon(t) as any} size={13} color={Colors.accent} />
            <Text style={styles.chipText} numberOfLines={1}>
              {t.title}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.chip, styles.browse]} onPress={() => setOpen((v) => !v)}>
          <Text style={styles.browseText}>{open ? tr('Close') : `${tr('Browse all')} · ${list.length}`}</Text>
        </TouchableOpacity>
      </View>

      {open && (
        <View style={styles.panel}>
          <View style={styles.search}>
            <Ionicons name="search" size={14} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={tr('Search your templates')}
              placeholderTextColor={Colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
          </View>
          <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
            {shown.map((t) => (
              <TouchableOpacity key={t.id} style={styles.item} onPress={() => insert(t)}>
                <Ionicons name={templateTopicIcon(t) as any} size={16} color={Colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{t.title}</Text>
                  <Text style={styles.itemPreview} numberOfLines={2}>
                    {templateTopicName(t)} · {t.body.replace(/^.*\n+/, '').replace(/\s+/g, ' ').slice(0, 140)}
                  </Text>
                </View>
                <Text style={styles.insert}>{tr('Insert')}</Text>
              </TouchableOpacity>
            ))}
            {shown.length === 0 && <Text style={styles.muted}>{tr('No template matches “{query}”.', { query })}</Text>}
          </ScrollView>
          <TouchableOpacity onPress={() => router.push('/pro-templates')}>
            <Text style={styles.manage}>{tr('Manage templates')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  label: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', marginRight: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 260, borderWidth: 1, borderColor: withAlpha(Colors.accent, 0.45), borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { color: Colors.accent, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  browse: { borderColor: Colors.cardBorder },
  browseText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  panel: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 12, padding: 10, gap: 6 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 10 },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 13, paddingVertical: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  itemTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },
  itemPreview: { color: Colors.textSecondary, fontSize: 12, lineHeight: 16, marginTop: 1 },
  insert: { color: Colors.accent, fontSize: 12, fontWeight: '800' },
  muted: { color: Colors.textSecondary, fontSize: 12, paddingVertical: 8 },
  manage: { color: Colors.accent, fontSize: 12, fontWeight: '700', marginTop: 2 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  emptyText: { color: Colors.accent, fontSize: 12, fontWeight: '700', flexShrink: 1 },
});
