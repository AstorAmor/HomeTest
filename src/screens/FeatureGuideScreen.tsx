import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FeaturePreview } from '@/components/FeaturePreview';
import { Colors, withAlpha } from '@/constants/colors';
import { AppSection, appPrefs, isSectionVisible, SECTION_OPTIONS, useAppPrefs } from '@/data/appPrefs';
import { FEATURE_GUIDE } from '@/data/featureGuide';

// Guía de cada parte de la app: para qué sirve, qué haces tú, qué recibes, qué avisos manda y
// una vista previa. ?id=<sección> abre una; sin id, todas.
export const FeatureGuideScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const prefs = useAppPrefs();
  const one = SECTION_OPTIONS.find((o) => o.id === params.id);
  const list = one ? [one] : SECTION_OPTIONS;

  const block = (label: string, text: string) => (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={one ? one.title : 'How each part works'} showBack />
        {list.map((o) => {
          const g = FEATURE_GUIDE[o.id as AppSection];
          const on = isSectionVisible(prefs, o.id);
          return (
            <View key={o.id} style={styles.card}>
              {!one && (
                <View style={styles.titleRow}>
                  <Ionicons name={o.icon as any} size={20} color={Colors.accent} />
                  <Text style={styles.title}>{o.title}</Text>
                </View>
              )}
              <FeaturePreview section={o.id} />
              {block('What it is for', g.what)}
              {block('What you do', g.youDo)}
              {block('What you get', g.youGet)}
              {g.notifications && block('Notifications', `${g.notifications} You can mute any of them.`)}
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{on ? 'On in your app' : 'Off in your app'}</Text>
                <Switch
                  value={on}
                  onValueChange={(v) => appPrefs.setSectionVisible(o.id, v)}
                  trackColor={{ false: Colors.cardBorder, true: withAlpha(Colors.accent, 0.6) }}
                  thumbColor={on ? Colors.accent : Colors.textMuted}
                />
              </View>
              {g.evidenceTopic && (
                <TouchableOpacity
                  style={styles.howRow}
                  onPress={() => router.push({ pathname: '/evidence', params: { topic: g.evidenceTopic! } })}
                >
                  <Ionicons name="information-circle-outline" size={16} color={Colors.accent} />
                  <Text style={styles.how}>How we calculate it</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 14,
    gap: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  block: { gap: 2 },
  label: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  text: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: 10,
  },
  switchLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  how: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
});
