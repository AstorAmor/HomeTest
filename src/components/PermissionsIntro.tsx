import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { turnOnPhoneReminders } from '@/data/phoneReminders';
import { t } from '@/i18n';

// La primera vez que se abre la app en este móvil (con sesión de paciente), antes de que el sistema
// pida nada: qué permisos usa Kuova, para qué y cuándo los pide, y que se puede decir que no. «Continuar»
// pide ya el de los avisos (recordatorios y timbre del entrenamiento); el resto se pide cuando se usa lo
// que lo necesita (cámara al escanear, micrófono al grabar, Health Connect al conectar el reloj). Una
// sola vez por instalación; también lo ve una vez quien ya tenía la app.
const KEY = 'permissionsIntro.v1';

const ROWS: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  { icon: 'notifications-outline', title: 'Notifications', text: 'For your medication reminders and the workout bell. We ask for this one now.' },
  {
    icon: 'watch-outline',
    title: Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect',
    text: 'To read the steps, sleep and heart rate from your watch. We ask when you connect it.',
  },
  { icon: 'camera-outline', title: 'Camera and photos', text: 'To scan your lab reports and take photos of your meals. Only when you use them.' },
  { icon: 'mic-outline', title: 'Microphone', text: 'For voice notes. Only while you record.' },
];

export function PermissionsIntro() {
  const { initializing, isLoggedIn, professional, demoMode } = useAuth();
  const patient = isLoggedIn && !professional && demoMode !== 'pro';
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (initializing || !patient || Platform.OS === 'web') return;
    AsyncStorage.getItem(KEY)
      .then((v) => !v && setShow(true))
      .catch(() => undefined);
  }, [initializing, patient]);

  const close = async (askNow: boolean) => {
    setShow(false);
    await AsyncStorage.setItem(KEY, new Date().toISOString()).catch(() => undefined);
    if (askNow) await turnOnPhoneReminders().catch(() => undefined);
  };

  if (!show) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => close(false)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.icon}>
              <Ionicons name="shield-checkmark-outline" size={26} color={Colors.accent} />
            </View>
            <Text style={styles.title}>{t('Before we start')}</Text>
            <Text style={styles.intro}>{t('Kuova will ask your phone for a few permissions. They help us give you the best experience:')}</Text>
            {ROWS.map((r) => (
              <View key={r.title} style={styles.row}>
                <Ionicons name={r.icon} size={20} color={Colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{t(r.title)}</Text>
                  <Text style={styles.rowText}>{t(r.text)}</Text>
                </View>
              </View>
            ))}
            <Text style={styles.note}>
              {t('You are free to say no to any of them: Kuova keeps working, although some features may not be available. You can change them at any time in your phone settings.')}
            </Text>
          </ScrollView>
          <TouchableOpacity style={styles.primary} onPress={() => close(true)}>
            <Text style={styles.primaryText}>{t('Continue')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={() => close(false)}>
            <Text style={styles.secondaryText}>{t('Not now')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 440, maxHeight: '90%', backgroundColor: Colors.background, borderRadius: 20, borderWidth: 1, borderColor: Colors.cardBorder, padding: 20 },
  body: { gap: 12, paddingBottom: 8 },
  icon: { alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.textPrimary, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: Colors.card, borderRadius: 14, padding: 12 },
  rowTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  rowText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  note: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  primary: { alignItems: 'center', backgroundColor: Colors.accent, borderRadius: 24, paddingVertical: 13, marginTop: 10 },
  primaryText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  secondary: { alignItems: 'center', paddingVertical: 11 },
  secondaryText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
});
