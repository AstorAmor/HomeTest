import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DailyCall } from '@/components/DailyCall';
import { OnDark } from '@/constants/colors';
import { getVideoJoinUrl } from '@/data/video';

import { t } from '@/i18n';
// Videoconsulta del paciente (Daily): pide la sala al servidor y la abre.
export const VideoCallScreen = () => {
  const router = useRouter();
  const { appt, title } = useLocalSearchParams<{ appt: string; title?: string }>();
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getVideoJoinUrl(appt)
      .then(setJoinUrl)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not open the video'));
  }, [appt]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {title ?? 'Video consultation'}
        </Text>
        <TouchableOpacity onPress={close} hitSlop={10} accessibilityLabel={t('Close')}>
          <Ionicons name="close" size={26} color={OnDark.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.body}>
        {joinUrl ? (
          <DailyCall joinUrl={joinUrl} onClose={close} />
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={36} color={OnDark.text} />
            <Text style={styles.text}>{error}</Text>
          </View>
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color={OnDark.text} />
            <Text style={styles.text}>{t('Preparing your video room…')}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: OnDark.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  title: { color: OnDark.text, fontSize: 17, fontWeight: '800', flex: 1 },
  body: { flex: 1, padding: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  text: { color: OnDark.text, fontSize: 15, textAlign: 'center' },
});
