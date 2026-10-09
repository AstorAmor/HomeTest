import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, withAlpha } from '@/constants/colors';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { labUploadRepository } from '@/data/labUploads';
import { userFlags } from '@/data/userFlags';
import { LAB_REPORTS } from '@/utils/labReportView';
import { dateLocale, t } from '@/i18n';

// "Your files": los informes que nos envía el laboratorio y todo lo que sube el usuario (escaneado
// o PDF), en una lista. Cada archivo puede llevar el nombre que el usuario quiera dentro de la app
// (user_flags "file_names"), sin importar cómo se llame fuera.

const NAMES_KEY = 'file_names';

interface FileItem {
  id: string;
  defaultName: string;
  source: 'lab' | 'upload';
  sourceLabel: string;
  addedAt: string; // ISO o YYYY-MM-DD
  open: () => void;
}

const fmt = (d: string) =>
  new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

export const FilesScreen = () => {
  const router = useRouter();
  const [files, setFiles] = useDeepState<FileItem[]>([]);
  const [names, setNames] = useDeepState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    const [uploads, saved] = await Promise.all([labUploadRepository.getAll().catch(() => []), userFlags.get(NAMES_KEY)]);
    const fromLab: FileItem[] = LAB_REPORTS.map((r) => ({
      id: `lab:${r.id}`,
      defaultName: t(r.title),
      source: 'lab',
      sourceLabel: r.lab,
      addedAt: r.report.test_date,
      open: () => (r.id === 'current' ? router.push('/report-summary') : router.push({ pathname: '/lab-report', params: { id: r.id } })),
    }));
    const mine: FileItem[] = uploads.map((u) => ({
      id: `upload:${u.id}`,
      defaultName: u.labName ? t('Lab report · {lab}', { lab: u.labName }) : t('Uploaded lab report'),
      source: 'upload',
      sourceLabel: t('Uploaded by you'),
      addedAt: u.createdAt,
      open: () => router.push({ pathname: '/progress', params: { upload: u.id } }),
    }));
    setFiles([...fromLab, ...mine].sort((a, b) => b.addedAt.localeCompare(a.addedAt)));
    setNames(saved && typeof saved === 'object' ? (saved as Record<string, string>) : {});
  }, [router, setFiles, setNames]);
  useReloadOnFocus(load);

  const saveName = async (id: string) => {
    const next = { ...names };
    if (draft.trim()) next[id] = draft.trim();
    else delete next[id];
    setNames(next);
    setEditing(null);
    await userFlags.set(NAMES_KEY, next);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={t('Your files')} showBack backFallback="/(tabs)?tab=1" />

        <TouchableOpacity style={styles.add} onPress={() => router.push('/upload-test')} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.background} />
          <Text style={styles.addText}>{t('Add a file (scan or PDF)')}</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          {files.length === 0 && <Text style={styles.empty}>{t('No files yet.')}</Text>}
          {files.map((f, i) => {
            const name = names[f.id] ?? f.defaultName;
            const isEditing = editing === f.id;
            return (
              <View key={f.id} style={[styles.row, i > 0 && styles.divider]}>
                <View style={[styles.icon, { backgroundColor: withAlpha(f.source === 'lab' ? Colors.gold : Colors.accent, 0.14) }]}>
                  <Ionicons name={f.source === 'lab' ? 'flask-outline' : 'document-text-outline'} size={18} color={f.source === 'lab' ? Colors.gold : Colors.accent} />
                </View>
                {isEditing ? (
                  <TextInput
                    style={styles.input}
                    value={draft}
                    onChangeText={setDraft}
                    autoFocus
                    placeholder={f.defaultName}
                    placeholderTextColor={Colors.textMuted}
                    onSubmitEditing={() => saveName(f.id)}
                    onBlur={() => saveName(f.id)}
                    returnKeyType="done"
                  />
                ) : (
                  <TouchableOpacity style={{ flex: 1 }} onPress={f.open} activeOpacity={0.8}>
                    <Text style={styles.name} numberOfLines={2}>
                      {name}
                    </Text>
                    <Text style={styles.meta}>
                      {f.source === 'lab' ? t('Received {date}', { date: fmt(f.addedAt) }) : t('Uploaded {date}', { date: fmt(f.addedAt) })} · {f.sourceLabel}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => {
                    if (isEditing) return saveName(f.id);
                    setDraft(names[f.id] ?? '');
                    setEditing(f.id);
                  }}
                  hitSlop={10}
                  accessibilityLabel={t('Rename')}
                >
                  <Ionicons name={isEditing ? 'checkmark' : 'create-outline'} size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
        <Text style={styles.hint}>{t('Tap the pencil to give a file your own name. It only changes inside Kuova.')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 13,
    borderRadius: 24,
    backgroundColor: Colors.accent,
  },
  addText: { color: Colors.background, fontSize: 15, fontWeight: '700' },
  card: { marginHorizontal: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  divider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  empty: { color: Colors.textMuted, fontSize: 14, paddingVertical: 16 },
  hint: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginHorizontal: 24, marginTop: 10 },
});
