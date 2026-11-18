import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Chev, SecHead } from '@/components/fine/Fine';
import { LineEmblem } from '@/components/fine/LineEmblem';
import { LEARNING_TOPICS, type LearningTopic } from '@/data/learning';
import { t } from '@/i18n';
import { FINE, fine } from '@/theme/fine';

// Aprende (/learn-all; desde Tú → Aprende). El fundador, 2026-11-16: «en seguir aprendiendo creo que tampoco has
// adaptado la estética». Como el prototipo (borradores/app-estructura/prototipo, `k==='aprende'`): una lista de
// filas con línea fina, cada tema con su dibujo a línea en un aro fino (en lugar de las manchas de color), primero
// los destacados y luego el resto.
export const LearnAllScreen = () => {
  const router = useRouter();
  const open = (x: LearningTopic) => router.push({ pathname: '/learn', params: { topic: x.id } });
  const featured = LEARNING_TOPICS.filter((x) => x.featured);
  const rest = LEARNING_TOPICS.filter((x) => !x.featured);
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Learn')} showBack />
        <View style={styles.pad}>
          <Text style={fine.lead}>{t('Short reads about sleep, food, exercise and more.')}</Text>

          <SecHead title={t('Featured')} />
          {featured.map((x, i) => (
            <TopicRow key={x.id} topic={x} onPress={() => open(x)} last={i === featured.length - 1} />
          ))}

          {rest.length ? (
            <>
              <SecHead title={t('More topics')} />
              {rest.map((x, i) => (
                <TopicRow key={x.id} topic={x} onPress={() => open(x)} last={i === rest.length - 1} />
              ))}
            </>
          ) : null}

          <Text style={[fine.note, styles.note]}>{t('General information, not medical advice.')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Un tema: su dibujo a línea, el nombre y de qué trata, y la flecha
function TopicRow({ topic, onPress, last }: { topic: LearningTopic; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity
      style={[fine.row, styles.row, last && styles.noLine]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${t(topic.label)}. ${t(topic.subtitle)}`}
    >
      <LineEmblem icon={topic.icon} size={40} color={FINE.jade} />
      <View style={styles.flex}>
        <Text style={fine.rowTitle} numberOfLines={1}>
          {t(topic.label)}
        </Text>
        <Text style={fine.rowSub} numberOfLines={1}>
          {t(topic.subtitle)}
        </Text>
      </View>
      <Chev />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  pad: { paddingHorizontal: 20 },
  row: { gap: 14, minHeight: 62 },
  noLine: { borderBottomWidth: 0 },
  flex: { flex: 1, minWidth: 0 },
  note: { marginTop: 22, textAlign: 'center' },
});
