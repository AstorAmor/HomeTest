import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Linking, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FRow } from '@/components/fine/Fine';
import { OriginalFile, originalFiles } from '@/data/labUploads';
import { t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// El original de una analítica subida (Tus archivos → Ver original): las fotos, una debajo de otra y
// a todo lo ancho; un PDF se abre con el visor del móvil. Enlaces firmados de 1 h del bucket privado.
// Desde el 2026-11-16, en fino: el PDF en una fila con línea fina y cada página con su número pequeño encima.
export const LabOriginalScreen = () => {
  const { upload } = useLocalSearchParams<{ upload: string }>();
  const { width } = useWindowDimensions();
  const [files, setFiles] = useState<OriginalFile[] | null>(null);
  const [ratios, setRatios] = useState<Record<string, number>>({});

  useEffect(() => {
    if (upload) originalFiles(upload).then(setFiles).catch(() => setFiles([]));
  }, [upload]);

  const pageWidth = Math.min(width - 40, 760);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title={t('Original file')} showBack backFallback="/files" />
        {files === null ? (
          <ActivityIndicator color={FINE.jade} style={{ marginTop: 40 }} />
        ) : files.length === 0 ? (
          <Text style={styles.empty}>{t('This report was uploaded before Kuova kept the originals, so only its values were saved.')}</Text>
        ) : (
          files.map((f, i) =>
            f.kind === 'pdf' ? (
              <FRow
                key={f.name}
                title={t('Open the PDF')}
                onPress={() => Linking.openURL(f.url)}
                right={<Ionicons name="open-outline" size={16} color={FINE.mute} />}
                style={styles.pdf}
              />
            ) : (
              <View key={f.name} style={styles.page}>
                {files.length > 1 && <Text style={[fine.kicker, styles.pageLabel]}>{t('Page {n}', { n: i + 1 })}</Text>}
                <Image
                  source={{ uri: f.url }}
                  style={[styles.image, { width: pageWidth, height: pageWidth * (ratios[f.name] ?? 1.41) }]}
                  contentFit="contain"
                  onLoad={(e) => {
                    const { width: w, height: h } = e.source;
                    if (w && h) setRatios((r) => ({ ...r, [f.name]: h / w }));
                  }}
                  accessibilityLabel={t('Page {n}', { n: i + 1 })}
                />
              </View>
            ),
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { ...ff('regular'), color: FINE.mute, fontSize: 14, lineHeight: 20, marginTop: 20 },
  pdf: { borderTopWidth: 1, borderTopColor: FINE.line },
  page: { marginBottom: 18, alignItems: 'center' },
  pageLabel: { alignSelf: 'flex-start', marginBottom: 8 },
  image: { borderRadius: 10, borderWidth: 1, borderColor: FINE.line },
});
