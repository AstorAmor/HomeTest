import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LabReportTable } from '@/components/LabReportTable';
import { Colors } from '@/constants/colors';
import { getApiBaseUrl } from '@/utils/apiBaseUrl';
import { ExtractedLabReport, ExtractedParametro } from '@/types/labReport';
import { mergeLabReports } from '@/utils/mergeLabReports';

type Status = 'idle' | 'reading' | 'uploading' | 'done' | 'error';

interface CapturedPage {
  id: string;
  uri: string; // uri ya redimensionada, lista para previsualizar y enviar
  mimeType: string;
  base64: string;
}

const REQUEST_TIMEOUT_MS = 60000;
const BATCH_SIZE = 2;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Redimensiona y comprime una foto para que el payload sea manejable (varias
// páginas en una sola llamada pueden pesar mucho si no se comprimen antes)
async function prepareImage(uri: string): Promise<{ uri: string; base64: string }> {
  const result = await manipulateAsync(uri, [{ resize: { width: 1600 } }], {
    compress: 0.6,
    format: SaveFormat.JPEG,
    base64: true,
  });
  return { uri: result.uri, base64: result.base64 ?? '' };
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export const UploadTestScreen = () => {
  const [pages, setPages] = useState<CapturedPage[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [report, setReport] = useState<ExtractedLabReport | null>(null);
  const [rawJson, setRawJson] = useState('');
  const [errorText, setErrorText] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const resetResult = () => {
    setReport(null);
    setRawJson('');
    setErrorText('');
    setShowRaw(false);
  };

  const addPages = (newPages: CapturedPage[]) => {
    resetResult();
    setPages((prev) => [...prev, ...newPages]);
  };

  const removePage = (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  };

  const processFiles = async (files: CapturedPage[]) => {
    resetResult();
    setStatus('uploading');

    const batches = chunk(files, BATCH_SIZE);
    setProgress({ done: 0, total: batches.length });

    try {
      const partialReports: ExtractedLabReport[] = [];

      for (let i = 0; i < batches.length; i++) {
        if (i > 0) {
          // pequeña pausa entre lotes para no ráfagas de peticiones a Gemini
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        const batch = batches[i];
        const payloadFiles = batch.map((f) => ({ base64: f.base64, mimeType: f.mimeType }));

        const response = await fetchWithTimeout(
          `${getApiBaseUrl()}/api/extract`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: payloadFiles }),
          },
          REQUEST_TIMEOUT_MS
        );

        const data = await response.json();

        if (!response.ok) {
          setStatus('error');
          setErrorText(JSON.stringify(data, null, 2));
          setProgress(null);
          return;
        }

        partialReports.push(data as ExtractedLabReport);
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }

      const merged = mergeLabReports(partialReports);
      setStatus('done');
      setReport(merged);
      setRawJson(JSON.stringify(merged, null, 2));
    } catch (err) {
      setStatus('error');
      const isAbort = err instanceof Error && err.name === 'AbortError';
      setErrorText(
        isAbort
          ? `Un lote tardó más de ${REQUEST_TIMEOUT_MS / 1000}s y se canceló. Prueba con menos páginas por lote o fotos más ligeras.`
          : err instanceof Error
            ? err.message
            : 'Error desconocido'
      );
    } finally {
      setProgress(null);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setPages([]);
    resetResult();
    setStatus('reading');

    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await processFiles([
      {
        id: asset.uri,
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'application/pdf',
        base64,
      },
    ]);
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setStatus('error');
      setErrorText('Permiso de galería denegado');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (result.canceled || !result.assets?.length) return;

    setStatus('reading');
    const prepared = await Promise.all(
      result.assets.map(async (asset, i) => {
        const { uri, base64 } = await prepareImage(asset.uri);
        return { id: `${Date.now()}-${i}`, uri, mimeType: 'image/jpeg', base64 };
      })
    );
    setStatus('idle');
    addPages(prepared);
  };

  const addPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setStatus('error');
      setErrorText('Permiso de cámara denegado');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });

    if (result.canceled || !result.assets?.[0]) return;

    setStatus('reading');
    const { uri, base64 } = await prepareImage(result.assets[0].uri);
    setStatus('idle');
    addPages([{ id: `${Date.now()}`, uri, mimeType: 'image/jpeg', base64 }]);
  };

  const analyzePages = () => {
    if (pages.length === 0) return;
    processFiles(pages);
  };

  const updateParametro = (
    seccionIndex: number,
    parametroIndex: number,
    updated: ExtractedParametro
  ) => {
    setReport((prev) => {
      if (!prev) return prev;
      const secciones = prev.secciones.map((s, si) => {
        if (si !== seccionIndex) return s;
        const parametros = s.parametros.map((p, pi) => (pi === parametroIndex ? updated : p));
        return { ...s, parametros };
      });
      return { ...prev, secciones };
    });
  };

  const isBusy = status === 'reading' || status === 'uploading';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Subir análisis (test)" showBack />

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.button} onPress={pickDocument} disabled={isBusy}>
            <Ionicons name="document-text-outline" size={20} color={Colors.accent} />
            <Text style={styles.buttonText}>Elegir PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={addPhoto} disabled={isBusy}>
            <Ionicons name="camera-outline" size={20} color={Colors.accent} />
            <Text style={styles.buttonText}>Añadir foto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={pickFromGallery} disabled={isBusy}>
            <Ionicons name="images-outline" size={20} color={Colors.accent} />
            <Text style={styles.buttonText}>Añadir desde galería</Text>
          </TouchableOpacity>
        </View>

        {pages.length > 0 && (
          <View style={styles.pagesSection}>
            <Text style={styles.pagesTitle}>
              {pages.length} página{pages.length > 1 ? 's' : ''} añadida
              {pages.length > 1 ? 's' : ''}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pagesRow}>
              {pages.map((page, index) => (
                <View key={page.id} style={styles.thumbWrap}>
                  <Image source={{ uri: page.uri }} style={styles.thumb} />
                  <Text style={styles.thumbIndex}>{index + 1}</Text>
                  <TouchableOpacity
                    style={styles.thumbRemove}
                    onPress={() => removePage(page.id)}
                    disabled={isBusy}
                  >
                    <Ionicons name="close-circle" size={20} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.analyzeButton, isBusy && styles.buttonDisabled]}
              onPress={analyzePages}
              disabled={isBusy}
            >
              <Ionicons name="checkmark-circle" size={18} color={Colors.background} />
              <Text style={styles.analyzeButtonText}>
                Analizar {pages.length} página{pages.length > 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isBusy && (
          <View style={styles.statusRow}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={styles.statusText}>
              {status === 'reading'
                ? 'Leyendo archivos…'
                : progress
                  ? `Extrayendo lote ${progress.done + 1} de ${progress.total}…`
                  : 'Extrayendo datos con IA…'}
            </Text>
          </View>
        )}

        {status === 'error' && errorText ? (
          <View style={styles.resultBox}>
            <Text style={[styles.resultLabel, { color: Colors.danger }]}>Error</Text>
            <Text style={styles.rawText}>{errorText}</Text>
          </View>
        ) : null}

        {report ? (
          <View style={styles.tableWrap}>
            <LabReportTable report={report} onUpdateParametro={updateParametro} />

            <TouchableOpacity style={styles.rawToggle} onPress={() => setShowRaw((v) => !v)}>
              <Text style={styles.rawToggleText}>
                {showRaw ? 'Ocultar JSON crudo' : 'Ver JSON crudo'}
              </Text>
            </TouchableOpacity>

            {showRaw && (
              <View style={styles.resultBoxNested}>
                <Text style={styles.rawText}>{rawJson}</Text>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  buttons: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  pagesSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  pagesTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginBottom: 10,
  },
  pagesRow: {
    marginBottom: 14,
  },
  thumbWrap: {
    marginRight: 12,
    alignItems: 'center',
  },
  thumb: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: Colors.card,
  },
  thumbIndex: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  thumbRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.background,
    borderRadius: 10,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
  },
  analyzeButtonText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
  fileName: {
    color: Colors.textSecondary,
    fontSize: 13,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  statusText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  tableWrap: {
    paddingHorizontal: 20,
  },
  rawToggle: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  rawToggleText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  resultBox: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  resultBoxNested: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  rawText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});
