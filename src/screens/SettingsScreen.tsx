import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PreferencesBlock } from '@/components/PreferencesBlock';
import { WeekStartSetting } from '@/components/metas/WeekStartSetting';
import { AppLockSetting } from '@/components/AppLockSetting';
import { FRow, SecHead } from '@/components/fine/Fine';
import { FLink } from '@/components/fine/FineForm';
import { SwitchRow, settingsStyles } from '@/components/settings/SettingsParts';
import { Colors } from '@/constants/colors';
import { t } from '@/i18n';
import { withSystemUi } from '@/utils/systemUi';
import { TAB, tabHref } from '@/constants/tabs';
import { useAuth } from '@/context/AuthContext';
import { isRealAccount, setRealAccount } from '@/data/dataMode';
import { reloadKeepingPlace } from '@/theme/appearance';
import { fine } from '@/theme/fine';

const PERMISSIONS: { title: string; why: string }[] = [
  { title: 'Notifications', why: 'Reminders for your medication, check-ins and tests.' },
  { title: 'Health data', why: Platform.OS === 'ios' ? 'Read sleep, heart rate and steps from Apple Health or your wearable.' : 'Read sleep, heart rate and steps from Health Connect or your wearable.' },
  { title: 'Camera', why: 'Scan a lab report to add it to your files.' },
  { title: 'Photos and files', why: 'Upload a PDF or a photo of your results.' },
  { title: 'Location', why: 'Show the labs closest to you. Only while you use that screen.' },
];

// Settings: idioma, tamaño de letra, la semana, lo que ves (Configure my experience), notificaciones, permisos
// y la cuenta. Idioma y letra recargan la app con un fundido y vuelven aquí.
// Desde el 2026-11-17, en el lenguaje fino (como la pestaña Tú; el fundador: «Ajustes parece que dentro tampoco está
// actualizado… de repente tengo mil iconos»): cabeceras pequeñas, filas con línea fina, título y explicación
// apagada, sin iconos ni tarjetas. Desde el 2026-11-17 se llama «Preferencias» (en Tú, «Ajustes › Ajustes» se repetía;
// el fundador pidió otro nombre) y «Cerrar sesión» está al final de Mi perfil.
export const SettingsScreen = () => {
  const router = useRouter();
  const { authMode, user, isTester } = useAuth();
  const [real, setReal] = useState(isRealAccount());
  // Cuenta real ↔ de prueba: cambia lo que se enseña en toda la app, así que recarga (vuelve aquí)
  const toggleReal = async (v: boolean) => {
    setReal(v);
    await setRealAccount(v);
    await reloadKeepingPlace(Colors.background, '/settings');
  };
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Preferences')} showBack backFallback={tabHref(TAB.you)} />

        <View style={settingsStyles.body}>
          <PreferencesBlock returnTo="/settings" fine />

          <WeekStartSetting />

          <SecHead title={t('Your experience')} />
          <FRow
            title={t('Configure my experience')}
            sub={t('What you use Kuova for sets what you see and which options appear')}
            onPress={() => router.push('/app-sections')}
          />
          <FRow
            title={t('Notifications')}
            sub={t('What we send you, and mute anything you do not want')}
            onPress={() => router.push('/notifications')}
            last
          />

          <SecHead title={t('Permissions')} />
          {PERMISSIONS.map((p) => (
            <FRow key={p.title} title={t(p.title)} sub={t(p.why)} />
          ))}
          {Platform.OS === 'web' ? (
            <Text style={fine.note}>{t('Your browser asks for each permission the first time it is needed.')}</Text>
          ) : (
            <FLink label={t('Change them in your phone settings')} onPress={() => withSystemUi(() => Linking.openSettings())} style={settingsStyles.linkLeft} />
          )}

          {authMode === 'supabase' && (
            <>
              <SecHead title={t('Account')} />
              <FRow title={t('Your name')} sub={user?.nombre} onPress={() => router.push('/your-name')} />
              <FRow
                title={t('Two-step verification')}
                sub={t('A code from an authenticator app when you sign in')}
                onPress={() => router.push('/security' as any)}
              />
              {/* Face ID / huella: solo con el módulo nativo (APK o app de iPhone desde el 2026-11-11) */}
              <AppLockSetting />
              {/* Cuenta real ↔ de prueba y casos de prueba: solo probadores (admins y sus «+alias») */}
              {isTester && (
                <SwitchRow
                  title={t('Real account')}
                  sub={
                    real
                      ? t('Only your own data. Nothing is filled in with examples.')
                      : t('Test account: where you have no data yet, Kuova shows examples.')
                  }
                  value={real}
                  onValueChange={toggleReal}
                  last={real}
                />
              )}
              {/* Solo cuentas de prueba: cargar un caso (tensión alta, energía baja…) o vaciarla */}
              {isTester && !real && (
                <FRow
                  title={t('Test scenarios')}
                  sub={t('Load a case into this test account (high blood pressure, low energy, skipped medication…) or clear it.')}
                  onPress={() => router.push('/simulation')}
                  last
                />
              )}
            </>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
});
