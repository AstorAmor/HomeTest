import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { OriginalFile, originalFiles } from '@/data/labUploads';
import { t } from '@/i18n';

// El original de una analítica subida (Tus archivos → Ver original): las fotos, una debajo de otra y
// a todo lo ancho; un PDF se abre con el visor del móvil. Enlaces firmados de 1 h del bucket privado.
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
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
        ) : files.length === 0 ? (
          <Text style={styles.empty}>{t('This report was uploaded before Kuova kept the originals, so only its values were saved.')}</Text>
        ) : (
          files.map((f, i) =>
            f.kind === 'pdf' ? (
              <TouchableOpacity key={f.name} style={styles.pdf} onPress={() => Linking.openURL(f.url)} activeOpacity={0.85}>
                <Ionicons name="document-text-outline" size={22} color={Colors.accent} />
                <Text style={styles.pdfText}>{t('Open the PDF')}</Text>
                <Ionicons name="open-outline" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : (
              <View key={f.name} style={styles.page}>
                {files.length > 1 && <Text style={styles.pageLabel}>{t('Page {n}', { n: i + 1 })}</Text>}
                <Image
                  source={{ uri: f.url }}
                  style={{ width: pageWidth, height: pageWidth * (ratios[f.name] ?? 1.41), borderRadius: 10 }}
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
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 20 },
  page: { marginBottom: 16, alignItems: 'center' },
  pageLabel: { alignSelf: 'flex-start', color: Colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  pdf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  pdfText: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
});
