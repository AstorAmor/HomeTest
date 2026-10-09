import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BlobArt } from '@/components/BlobArt';
import { Colors } from '@/constants/colors';
import { LEARNING_TOPICS } from '@/data/learning';
import { t } from '@/i18n';

// "More" de Keep learning: todos los temas en cuadrícula, dos por fila.
export const LearnAllScreen = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tile = Math.floor((Math.min(width, 520) - 20 * 2 - 12) / 2);
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Keep learning')} showBack />
        <View style={styles.grid}>
          {LEARNING_TOPICS.map((x) => (
            <TouchableOpacity
              key={x.id}
              style={{ width: tile }}
              onPress={() => router.push({ pathname: '/learn', params: { topic: x.id } })}
              activeOpacity={0.85}
            >
              <BlobArt seed={x.id} palette={x.palette} icon={x.icon} size={{ width: tile, height: Math.round(tile * 0.8) }} radius={18} />
              <Text style={styles.label} numberOfLines={1}>
                {t(x.label)}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {t(x.subtitle)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, rowGap: 18 },
  label: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800', marginTop: 8 },
  sub: { color: Colors.textSecondary, fontSize: 12, marginTop: 1 },
});
