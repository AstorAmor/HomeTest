import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionToggles } from '@/components/SectionToggles';
import { Colors, withAlpha } from '@/constants/colors';
import { appPrefs, isSectionVisible, PURPOSE_OPTIONS, SECTION_OPTIONS, useAppPrefs } from '@/data/appPrefs';
import { t } from '@/i18n';

// More → Configure my experience: para qué usa Kuova (una o varias cosas; aplica una configuración
// de secciones), qué partes ve y, desde cada una, su guía con vista previa. El fundador pidió
// (2026-10-30) que quede claro que esa respuesta define la experiencia: qué partes, tarjetas,
// opciones y avisos salen; por eso el aviso de arriba y el recuento que cambia al elegir.
export const AppSectionsScreen = () => {
  const router = useRouter();
  const prefs = useAppPrefs();
  const shown = SECTION_OPTIONS.filter((o) => isSectionVisible(prefs, o.id)).length;
  const count = { n: shown, total: SECTION_OPTIONS.length };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Configure my experience')} showBack backFallback="/settings" />

        <Text style={styles.sectionTitle}>{t('What do you use Kuova for?')}</Text>
        <View style={styles.explain}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.accent} />
          <Text style={styles.explainText}>
            {t(
              'Your answer shapes your experience: it decides which parts, cards and options appear in Today, My Data and the rest of the app, and which reminders you get. Pick one or more.',
            )}
          </Text>
        </View>
        <View style={styles.list}>
          {PURPOSE_OPTIONS.map((o) => {
            const selected = prefs.purposes.includes(o.id);
            return (
              <TouchableOpacity
                key={o.id}
                style={[styles.purpose, selected && styles.purposeSelected]}
                onPress={() =>
                  appPrefs.setPurposes(selected ? prefs.purposes.filter((p) => p !== o.id) : [...prefs.purposes, o.id])
                }
                activeOpacity={0.85}
              >
                <Ionicons name={o.icon as any} size={22} color={selected ? Colors.accent : Colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.purposeTitle}>{t(o.title)}</Text>
                  <Text style={styles.purposeSubtitle}>{t(o.subtitle)}</Text>
                </View>
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={selected ? Colors.accent : Colors.textMuted}
                />
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.summary}>
          {prefs.purposes.length
            ? t('With your answer you see {n} of {total} parts of the app.', count)
            : t('No answer yet: you see {n} of {total} parts of the app.', count)}
        </Text>

        <View style={styles.headerRow}>
          <Text style={[styles.sectionTitle, styles.inline]}>{t('What you see')}</Text>
          <TouchableOpacity onPress={() => router.push('/feature-guide')}>
            <Text style={styles.link}>{t('How each part works')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          {t('This comes from your answer above. Turn each part on or off as you like; if you change your answer, this list is set again.')}
        </Text>
        <View style={{ marginHorizontal: 20 }}>
          <SectionToggles isOn={(id) => isSectionVisible(prefs, id)} onToggle={(id, on) => appPrefs.setSectionVisible(id, on)} />
        </View>
        <Text style={styles.footnote}>{t('Your results, tests, sharing and professionals are always there.')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', marginHorizontal: 20, marginBottom: 10 },
  inline: { marginHorizontal: 0, marginBottom: 0 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 4,
  },
  link: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginHorizontal: 20, marginBottom: 12 },
  explain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: withAlpha(Colors.accent, 0.08),
  },
  explainText: { flex: 1, color: Colors.textPrimary, fontSize: 13, lineHeight: 18 },
  summary: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginHorizontal: 20, marginTop: 10 },
  list: { marginHorizontal: 20, gap: 10 },
  purpose: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 16,
  },
  purposeSelected: { borderColor: Colors.accent, backgroundColor: withAlpha(Colors.accent, 0.08) },
  purposeTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  purposeSubtitle: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  footnote: { color: Colors.textMuted, fontSize: 12, marginHorizontal: 20, marginTop: 12 },
});
