import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppIcon } from '@/components/HealthIcons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { UserAvatar } from '@/components/UserAvatar';
import { Colors, withAlpha } from '@/constants/colors';
import { mockPatient } from '@/data/mockData';
import { useAuth } from '@/context/AuthContext';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { GOAL_OPTIONS, profileRepository, UserProfile } from '@/data/profileRepository';
import { PURPOSE_OPTIONS, useAppPrefs } from '@/data/appPrefs';
import { t } from '@/i18n';
import { expectSystemUi } from '@/utils/systemUi';
import { TAB, tabHref } from '@/constants/tabs';
import { removeAvatar, setAvatar, useAvatar } from '@/data/avatar';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { AboutField, AboutYouRows, AboutYouSheet } from '@/components/profile/AboutYou';
import { fine, INTER } from '@/theme/fine';

export const ProfileScreen = () => {
  const router = useRouter();
  const { user } = useAuth();
  const photo = useAvatar();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [heroError, setHeroError] = useState('');

  const pickPhoto = async () => {
    setHeroError('');
    // La hoja del sistema sale encima de la app: que el bloqueo no la tape con la K (src/utils/systemUi.ts)
    expectSystemUi();
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled) return;
    setPhotoBusy(true);
    try {
      await setAvatar(result.assets[0].uri);
    } catch (e) {
      setHeroError(e instanceof Error ? e.message : t('Could not save the photo'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const dropPhoto = async () => {
    if (!(await confirmAsk(t('Remove your photo?'), t('Your initial will show instead.'), t('Remove')))) return;
    setPhotoBusy(true);
    await removeAvatar().catch(() => undefined);
    setPhotoBusy(false);
  };

  const [profile, setProfile] = useDeepState<UserProfile | null>(null);
  const prefs = useAppPrefs();
  const chosen = PURPOSE_OPTIONS.filter((p) => prefs.purposes.includes(p.id));
  const purpose = chosen.length === 1 ? chosen[0] : undefined;

  const load = useCallback(() => {
    profileRepository.get().then(setProfile);
  }, [setProfile]);

  useReloadOnFocus(load);

  // El dato de «Sobre ti» que se está cambiando (su hoja va por encima de la pantalla). Con ?edit=height se abre
  // directamente la altura (desde «Añade tu altura» del IMC en Peso, 2026-11-16)
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const [editing, setEditing] = useState<AboutField | null>(edit === 'height' ? 'height' : null);
  const closeSheet = useCallback(() => setEditing(null), []);

  const goals = GOAL_OPTIONS.filter((g) => profile?.goals.includes(g.id));

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']} importantForAccessibility={editing ? 'no-hide-descendants' : 'auto'}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScreenHeader title={t('My Profile')} showBack backFallback={tabHref(TAB.you)} />

          <View style={styles.hero}>
            {/* Tocar la foto: elegir otra de la galería */}
            <TouchableOpacity onPress={pickPhoto} disabled={photoBusy} activeOpacity={0.85} accessibilityLabel={t('Change photo')}>
              <UserAvatar size={84} />
              <View style={styles.cameraBadge}>
                {photoBusy ? <ActivityIndicator size="small" color={Colors.background} /> : <Ionicons name="camera" size={15} color={Colors.background} />}
              </View>
            </TouchableOpacity>
            {photo && !photoBusy && (
              <TouchableOpacity onPress={dropPhoto} hitSlop={8}>
                <Text style={styles.photoLink}>{t('Remove photo')}</Text>
              </TouchableOpacity>
            )}

            {/* El alias tiene su propia pantalla (/your-name), también en Ajustes → Cuenta */}
            <TouchableOpacity style={styles.nameRow} onPress={() => router.push('/your-name')} accessibilityLabel={t('Change your name')}>
              <Text style={styles.name}>{user?.nombre ?? mockPatient.nombre}</Text>
              <Ionicons name="pencil" size={15} color={Colors.accent} />
            </TouchableOpacity>
            <Text style={styles.email}>{user?.email ?? mockPatient.email}</Text>
            {heroError ? <Text style={styles.heroError}>{heroError}</Text> : null}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('What you use Kuova for')}</Text>
            <TouchableOpacity onPress={() => router.push('/app-sections')}>
              <Text style={styles.edit}>{t('Change')}</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.card, styles.purposeCard]}>
            <Ionicons name={(purpose?.icon ?? 'apps-outline') as any} size={20} color={Colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.purposeTitle}>{chosen.length ? chosen.map((c) => t(c.title)).join(' · ') : t('Everything')}</Text>
              <Text style={styles.purposeSubtitle}>
                {prefs.hidden.length
                  ? t(prefs.hidden.length === 1 ? '{n} section hidden' : '{n} sections hidden', { n: prefs.hidden.length })
                  : t('All sections visible')}
              </Text>
            </View>
          </View>

          {/* Sobre ti: cada dato se cambia con un toque en su fila, sin pasar por la pantalla de editar (fundador,
              2026-11-16). Por eso ya no lleva «Editar». */}
          <View style={[styles.sectionHeader, styles.afterCard]}>
            <Text style={styles.sectionTitle}>{t('About you')}</Text>
          </View>
          <View style={styles.aboutRows}>
            <AboutYouRows profile={profile} onEdit={setEditing} />
          </View>

          {!prefs.hidden.includes('plan') && (
            <>
              {/* Los objetivos se siguen cambiando en el cuestionario completo (el «Editar» que antes iba en Sobre ti) */}
              <View style={[styles.sectionHeader, styles.afterCard]}>
                <Text style={styles.sectionTitle}>{t('Your goals')}</Text>
                <TouchableOpacity onPress={() => router.push('/onboarding')} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.edit}>{t('Edit')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.goals}>
                {goals.length ? (
                  goals.map((g) => (
                    <View key={g.id} style={styles.goalChip}>
                      {/* AppIcon: las pesas salen con el dibujo único de la app (fine/dumbbell.ts) */}
                      <AppIcon name={g.icon} size={14} color={Colors.accent} />
                      <Text style={styles.goalText}>{t(g.label)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.rowEmpty}>{t('No goals yet. Tap Edit to add them.')}</Text>
                )}
              </View>
            </>
          )}


        </ScrollView>
      </SafeAreaView>
      {editing && profile ? <AboutYouSheet key={editing} field={editing} profile={profile} onClose={closeSheet} onSaved={setProfile} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 32 },
  hero: { alignItems: 'center', paddingHorizontal: 20, marginBottom: 24 },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLink: { color: Colors.textMuted, fontSize: 12, fontFamily: INTER.medium, marginTop: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  name: { color: Colors.textPrimary, fontSize: 22, fontFamily: INTER.medium },
  heroError: { color: Colors.attention, fontFamily: INTER.regular, fontSize: 13, marginTop: 8, textAlign: 'center' },
  email: { color: Colors.textSecondary, fontFamily: INTER.regular, fontSize: 14, marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: { ...fine.secTitle },
  edit: { color: Colors.accent, fontSize: 14, fontFamily: INTER.medium },
  afterCard: { marginTop: 22 },
  purposeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  purposeTitle: { color: Colors.textPrimary, fontSize: 15, fontFamily: INTER.medium },
  purposeSubtitle: { color: Colors.textSecondary, fontFamily: INTER.regular, fontSize: 12, marginTop: 2 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginHorizontal: 20,
  },
  // Sobre ti: filas con una línea fina, sin tarjeta (lenguaje fino del prototipo)
  aboutRows: { paddingHorizontal: 20 },
  rowEmpty: { color: Colors.textMuted, fontSize: 13, fontFamily: INTER.regular },
  goals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: withAlpha(Colors.accent, 0.35),
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  goalText: { color: Colors.textPrimary, fontFamily: INTER.regular, fontSize: 13 },
  badge: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: withAlpha(Colors.amber, 0.1),
    borderWidth: 1,
    borderColor: withAlpha(Colors.amber, 0.4),
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  badgeText: { color: Colors.amber, fontSize: 12, fontFamily: INTER.medium },
});
