import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { findTopic } from '@/data/learning';

// Tema de "Keep learning": introducción, ideas clave y una acción en la app.
export const LearnTopicScreen = () => {
  const router = useRouter();
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const t = findTopic(topic);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t.label} showBack />
        <Image source={t.image} style={styles.hero} contentFit="cover" />
        <Text style={styles.intro}>{t.intro}</Text>
        {t.lessons.map((l, i) => (
          <View key={l.title} style={styles.card}>
            <Text style={styles.num}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{l.title}</Text>
              <Text style={styles.body}>{l.body}</Text>
            </View>
          </View>
        ))}
        {t.action && (
          <TouchableOpacity style={styles.cta} onPress={() => router.push({ pathname: t.action!.href as any, params: t.action!.params })}>
            <Text style={styles.ctaText}>{t.action.label}</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.background} />
          </TouchableOpacity>
        )}
        <Text style={styles.note}>General information, not medical advice.</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  hero: { height: 200, marginHorizontal: 20, borderRadius: 20, marginBottom: 16 },
  intro: { color: Colors.textPrimary, fontSize: 16, lineHeight: 23, marginHorizontal: 20, marginBottom: 16 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 14, marginHorizontal: 20, marginBottom: 10 },
  num: { color: Colors.accent, fontSize: 18, fontWeight: '900', width: 20 },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  cta: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.accent, borderRadius: 26, paddingVertical: 14, marginHorizontal: 20, marginTop: 8 },
  ctaText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  note: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 14 },
});
