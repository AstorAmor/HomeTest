import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppearanceSwitch } from '@/components/AppearanceSwitch';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { getLang, Lang, LANGUAGES, saveLanguage, t } from '@/i18n';
import { getTextSize, saveTextSize, TEXT_SIZES, TextSize } from '@/theme/textSize';
import { reloadKeepingPlace } from '@/theme/appearance';

const PERMISSIONS: { icon: string; title: string; why: string }[] = [
  { icon: 'notifications-outline', title: 'Notifications', why: 'Reminders for your medication, check-ins and tests.' },
  { icon: 'fitness-outline', title: 'Health data', why: 'Read sleep, heart rate and steps from Health Connect or your wearable.' },
  { icon: 'camera-outline', title: 'Camera', why: 'Scan a lab report to add it to your files.' },
  { icon: 'document-outline', title: 'Photos and files', why: 'Upload a PDF or a photo of your results.' },
  { icon: 'location-outline', title: 'Location', why: 'Show the labs closest to you. Only while you use that screen.' },
];

// Settings: apariencia, idioma, tamaño de letra, permisos, lo que ves (Configure my experience) y
// notificaciones. Tema, idioma y letra recargan la app con un fundido y vuelven aquí.
export const SettingsScreen = () => {
  const router = useRouter();
  const { logout } = useAuth();
  const [size, setSize] = useState<TextSize>('default');
  const lang = getLang();
  useEffect(() => {
    getTextSize().then(setSize);
  }, []);

  const chooseLang = async (id: Lang) => {
    if (id === lang) return;
    await saveLanguage(id);
    await reloadKeepingPlace(Colors.background, '/settings');
  };
  const chooseSize = async (id: TextSize) => {
    if (id === size) return;
    setSize(id);
    await saveTextSize(id);
    await reloadKeepingPlace(Colors.background, '/settings');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Settings')} showBack backFallback="/(tabs)?tab=4" />

        <Text style={styles.section}>{t('Appearance')}</Text>
        <View style={styles.block}>
          <AppearanceSwitch returnTo="/settings" />
        </View>

        <Text style={styles.section}>{t('Language')}</Text>
        <View style={styles.card}>
          {LANGUAGES.map((l, i) => {
            const on = l.id === lang;
            return (
              <TouchableOpacity
                key={l.id}
                style={[styles.row, i > 0 && styles.divider, !l.ready && { opacity: 0.5 }]}
                disabled={!l.ready}
                onPress={() => chooseLang(l.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: !l.ready }}
              >
                <Text style={styles.rowTitle}>{l.name}</Text>
                {!l.ready && <Text style={styles.soon}>{t('Coming soon')}</Text>}
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? Colors.accent : Colors.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.section}>{t('Text size')}</Text>
        <View style={styles.sizes}>
          {TEXT_SIZES.map((s) => {
            const on = s.id === size;
            return (
              <TouchableOpacity key={s.id} style={[styles.size, on && styles.sizeOn]} onPress={() => chooseSize(s.id)}>
                <Text style={[styles.sizeSample, { fontSize: 15 * s.scale }, on && styles.sizeTextOn]}>Aa</Text>
                <Text style={[styles.sizeLabel, on && styles.sizeTextOn]}>{t(s.label)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.section}>{t('Your experience')}</Text>
        <View style={styles.card}>
          {[
            { icon: 'options-outline', title: 'Configure my experience', sub: 'What you use Kuova for, what you see and how each part works', to: '/app-sections' },
            { icon: 'notifications-outline', title: 'Notifications', sub: 'What we send you, and mute anything you do not want', to: '/notifications' },
          ].map((r, i) => (
            <TouchableOpacity key={r.to} style={[styles.row, i > 0 && styles.divider]} onPress={() => router.push(r.to as any)}>
              <Ionicons name={r.icon as any} size={22} color={Colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t(r.title)}</Text>
                <Text style={styles.rowSub}>{t(r.sub)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>{t('Permissions')}</Text>
        <View style={styles.card}>
          {PERMISSIONS.map((p, i) => (
            <View key={p.title} style={[styles.row, i > 0 && styles.divider]}>
              <Ionicons name={p.icon as any} size={22} color={Colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t(p.title)}</Text>
                <Text style={styles.rowSub}>{t(p.why)}</Text>
              </View>
            </View>
          ))}
          {Platform.OS === 'web' ? (
            <Text style={styles.permNote}>{t('Your browser asks for each permission the first time it is needed.')}</Text>
          ) : (
            <TouchableOpacity style={styles.systemButton} onPress={() => Linking.openSettings()}>
              <Text style={styles.systemButtonText}>{t('Change them in your phone settings')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.logout} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.logoutText}>{t('Log out')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  section: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700', marginHorizontal: 20, marginTop: 18, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  block: { marginHorizontal: 20 },
  card: { marginHorizontal: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  divider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  rowTitle: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  rowSub: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  soon: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  sizes: { flexDirection: 'row', gap: 8, marginHorizontal: 20 },
  size: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 10, borderRadius: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder },
  sizeOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  sizeSample: { color: Colors.textPrimary, fontWeight: '800' },
  sizeLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  sizeTextOn: { color: Colors.background },
  permNote: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, paddingHorizontal: 16, paddingBottom: 14 },
  systemButton: { margin: 12, marginTop: 4, borderWidth: 1, borderColor: Colors.accent, borderRadius: 22, paddingVertical: 10, alignItems: 'center' },
  systemButtonText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28, paddingVertical: 12 },
  logoutText: { color: Colors.danger, fontSize: 15, fontWeight: '700' },
});
