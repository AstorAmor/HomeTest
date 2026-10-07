import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, withAlpha } from '@/constants/colors';
import { appPrefs, PURPOSE_OPTIONS, SECTION_OPTIONS, useAppPrefs } from '@/data/appPrefs';

// More → Customise your app: para qué usa Kuova (aplica una configuración de
// secciones) y, debajo, cada sección por separado.
export const AppSectionsScreen = () => {
  const prefs = useAppPrefs();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Customise your app" showBack />

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

        <Text style={[styles.sectionTitle, styles.spaced]}>Sections</Text>
        <Text style={styles.hint}>Turn on only what you want to see. Choosing an option above resets these.</Text>
        <View style={styles.card}>
          {SECTION_OPTIONS.map((o, i) => {
            const visible = !prefs.hidden.includes(o.id);
            return (
              <View key={o.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                <Ionicons name={o.icon as any} size={20} color={visible ? Colors.accent : Colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{o.title}</Text>
                  <Text style={styles.rowSubtitle}>{o.subtitle}</Text>
                </View>
                <Switch
                  value={visible}
                  onValueChange={(v) => appPrefs.setSectionVisible(o.id, v)}
                  trackColor={{ false: Colors.cardBorder, true: withAlpha(Colors.accent, 0.6) }}
                  thumbColor={visible ? Colors.accent : Colors.textMuted}
                />
              </View>
            );
          })}
        </View>
        <Text style={styles.footnote}>
          Your results, tests, sharing and professionals are always there.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', marginHorizontal: 20, marginBottom: 10 },
  spaced: { marginTop: 24, marginBottom: 4 },
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
  card: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  rowTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  rowSubtitle: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  footnote: { color: Colors.textMuted, fontSize: 12, marginHorizontal: 20, marginTop: 12 },
});
