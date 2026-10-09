import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BlobArt } from '@/components/BlobArt';
import { Colors } from '@/constants/colors';
import { findTopic } from '@/data/learning';
import { t } from '@/i18n';

// Tema de "Keep learning": introducción, ideas clave, una acción en la app y las fuentes.
export const LearnTopicScreen = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { topic: topicId } = useLocalSearchParams<{ topic: string }>();
  const topic = findTopic(topicId);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t(topic.label)} showBack />
        <View style={styles.hero}>
          <BlobArt seed={topic.id} palette={topic.palette} icon={topic.icon} size={{ width: Math.min(width, 560) - 40, height: 180 }} iconSize={64} />
        </View>
        <Text style={styles.intro}>{t(topic.intro)}</Text>
        {topic.lessons.map((l, i) => (
          <View key={l.title} style={styles.card}>
            <Text style={styles.num}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t(l.title)}</Text>
              <Text style={styles.body}>{t(l.body)}</Text>
            </View>
          </View>
        ))}
        {topic.action && (
          <TouchableOpacity style={styles.cta} onPress={() => router.push({ pathname: topic.action!.href as any, params: topic.action!.params })}>
            <Text style={styles.ctaText}>{t(topic.action.label)}</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.background} />
          </TouchableOpacity>
        )}
        {topic.sources?.length ? (
          <View style={styles.sources}>
            <Text style={styles.sourcesTitle}>{t('Sources')}</Text>
            {topic.sources.map((s) => (
              <TouchableOpacity key={s.url} onPress={() => Linking.openURL(s.url)}>
                <Text style={styles.source}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        <Text style={styles.note}>{t('General information, not medical advice.')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  hero: { marginHorizontal: 20, marginBottom: 16 },
  intro: { color: Colors.textPrimary, fontSize: 16, lineHeight: 23, marginHorizontal: 20, marginBottom: 16 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 14, marginHorizontal: 20, marginBottom: 10 },
  num: { color: Colors.accent, fontSize: 18, fontWeight: '900', width: 20 },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  cta: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.accent, borderRadius: 26, paddingVertical: 14, marginHorizontal: 20, marginTop: 8 },
  ctaText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  sources: { marginHorizontal: 20, marginTop: 18 },
  sourcesTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800', marginBottom: 6 },
  source: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: 6, textDecorationLine: 'underline' },
  note: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 14 },
});
