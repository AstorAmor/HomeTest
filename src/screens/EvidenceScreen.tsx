import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, withAlpha } from '@/constants/colors';
import { EVIDENCE, EvidenceTopic } from '@/data/evidence';
import { t as tr } from '@/i18n';

// More → How KUOVA works, o el (i) de cada sitio (?topic=…): cómo calculamos cada cosa y las
// fuentes. Lo que aún revisa el equipo médico lo dice claramente.
export const EvidenceScreen = () => {
  const params = useLocalSearchParams<{ topic?: string }>();
  const [open, setOpen] = useState<Set<string>>(new Set(params.topic ? [params.topic] : []));
  const first = EVIDENCE.find((t) => t.id === params.topic);
  const [showAll, setShowAll] = useState(!first);
  const ordered = !first ? EVIDENCE : showAll ? [first, ...EVIDENCE.filter((t) => t !== first)] : [first];

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderTopic = (t: EvidenceTopic) => {
    const isOpen = open.has(t.id);
    return (
      <View key={t.id} style={styles.card}>
        <TouchableOpacity style={styles.header} onPress={() => toggle(t.id)} activeOpacity={0.85}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t.title}</Text>
            <Text style={styles.summary}>{t.summary}</Text>
          </View>
          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        {isOpen && (
          <View style={styles.body}>
            {t.body.map((p) => (
              <Text key={p} style={styles.paragraph}>
                {p}
              </Text>
            ))}
            {t.status === 'pending' && (
              <View style={styles.pending}>
                <Ionicons name="time-outline" size={14} color={Colors.attention} />
                <Text style={styles.pendingText}>{tr('Being reviewed by our medical team')}</Text>
              </View>
            )}
            {t.sources.length > 0 && (
              <>
                <Text style={styles.sourcesTitle}>{tr('Sources')}</Text>
                {t.sources.map((s) =>
                  s.url ? (
                    <TouchableOpacity key={s.label} onPress={() => WebBrowser.openBrowserAsync(s.url!)} style={styles.sourceRow}>
                      <Ionicons name="open-outline" size={14} color={Colors.accent} />
                      <Text style={styles.sourceLink}>{s.label}</Text>
                    </TouchableOpacity>
                  ) : (
                    <View key={s.label} style={styles.sourceRow}>
                      <Ionicons name="document-text-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.sourceText}>{s.label}</Text>
                    </View>
                  )
                )}
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={first && !showAll ? tr('How we calculate it') : tr('How KUOVA works')} showBack />
        {(!first || showAll) && (
          <Text style={styles.intro}>
            {tr('How we calculate what you see, and the studies and guidelines behind it. Look for the (i) next to a number or a suggestion to jump straight to its explanation.')}
          </Text>
        )}
        {ordered.map(renderTopic)}
        {first && !showAll && (
          <TouchableOpacity style={styles.allButton} onPress={() => setShowAll(true)} activeOpacity={0.8}>
            <Text style={styles.allText}>{tr('See how everything else works')}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.footer}>
          {tr('Kuova helps you understand your health and does not replace your doctor. If something worries you, talk to a professional.')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, paddingHorizontal: 20, marginBottom: 14 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  summary: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  body: { borderTopWidth: 1, borderTopColor: Colors.divider, padding: 14, gap: 8 },
  paragraph: { color: Colors.textPrimary, fontSize: 14, lineHeight: 21 },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: withAlpha(Colors.attention, 0.12),
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pendingText: { color: Colors.attention, fontSize: 12, fontWeight: '700' },
  sourcesTitle: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 6 },
  sourceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  sourceLink: { flex: 1, color: Colors.accent, fontSize: 13, lineHeight: 18, textDecorationLine: 'underline' },
  sourceText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  allButton: { alignSelf: 'center', paddingVertical: 12 },
  allText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  footer: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, paddingHorizontal: 20, marginTop: 10 },
});
