import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionToggles } from '@/components/SectionToggles';
import { Colors, withAlpha } from '@/constants/colors';
import { appPrefs, isSectionVisible, PURPOSE_OPTIONS, useAppPrefs } from '@/data/appPrefs';

// More → Configure my experience: para qué usa Kuova (aplica una configuración de secciones), qué
// partes ve (las opcionales, como medicación o Gut and bladder, solo si las enciende) y, desde cada
// una, su guía con vista previa.
export const AppSectionsScreen = () => {
  const router = useRouter();
  const prefs = useAppPrefs();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Configure my experience" showBack />

        <Text style={styles.sectionTitle}>What do you use Kuova for?</Text>
        <View style={styles.list}>
          {PURPOSE_OPTIONS.map((o) => {
            const selected = prefs.purpose === o.id;
            return (
              <TouchableOpacity
                key={o.id}
                style={[styles.purpose, selected && styles.purposeSelected]}
                onPress={() => appPrefs.setPurpose(o.id)}
                activeOpacity={0.85}
              >
                <Ionicons name={o.icon as any} size={22} color={selected ? Colors.accent : Colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.purposeTitle}>{o.title}</Text>
                  <Text style={styles.purposeSubtitle}>{o.subtitle}</Text>
                </View>
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={selected ? Colors.accent : Colors.textMuted}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.headerRow}>
          <Text style={[styles.sectionTitle, styles.inline]}>What you see</Text>
          <TouchableOpacity onPress={() => router.push('/feature-guide')}>
            <Text style={styles.link}>How each part works</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          Turn on only what you want. Optional parts stay off until you switch them on. Choosing an option above resets
          the others.
        </Text>
        <View style={{ marginHorizontal: 20 }}>
          <SectionToggles isOn={(id) => isSectionVisible(prefs, id)} onToggle={(id, on) => appPrefs.setSectionVisible(id, on)} />
        </View>
        <Text style={styles.footnote}>Your results, tests, sharing and professionals are always there.</Text>
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
