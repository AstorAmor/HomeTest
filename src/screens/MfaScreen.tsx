import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/colors';
import { CosmicBackground } from '@/components/CosmicBackground';
import { KuovaWordmark } from '@/components/KuovaLogo';
import { TotpSetup, totpErrorMessage, totpStyles } from '@/components/TotpSetup';
import { useAuth } from '@/context/AuthContext';
import { verifyLoginCode } from '@/data/mfa';
import { cleanTotpCode, isTotpCodeComplete, type MfaGate } from '@/logic/mfa';
import { t } from '@/i18n';

// Doble factor al entrar (lo pone MfaGuard en _layout delante de toda la app):
// - enroll: admin, profesional o soporte sin app de autenticación → darla de alta (obligatorio).
// - verify: ya la tiene → el código de 6 cifras de esta sesión.
// Sin esto, la base de datos no les enseña nada (migración 20261109180000_mfa_aal2.sql).
export const MfaScreen = ({ mode }: { mode: Exclude<MfaGate, null> }) => {
  const { refreshMfa, logout, user } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lostOpen, setLostOpen] = useState(false);

  const verify = async () => {
    setBusy(true);
    setError('');
    try {
      await verifyLoginCode(code);
      await refreshMfa();
    } catch (e) {
      setError(totpErrorMessage(e instanceof Error ? e.message : ''));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <CosmicBackground />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <KuovaWordmark height={28} color={Colors.isLight ? Colors.accent : Colors.textPrimary} />
            <View style={styles.badge}>
              <Ionicons name="shield-checkmark-outline" size={18} color={Colors.accent} />
              <Text style={styles.badgeText}>{t('Two-step verification')}</Text>
            </View>
          </View>

          {mode === 'enroll' ? (
            <>
              <Text style={styles.title}>{t('Protect your account')}</Text>
              <Text style={styles.text}>
                {t('Your account can see patient data, so Kuova asks for a second step when you sign in: a 6-digit code from an authenticator app.')}
              </Text>
              <Text style={[styles.text, { marginBottom: 18 }]}>
                {t('You can use Google Authenticator, Microsoft Authenticator, 1Password or any similar app.')}
              </Text>
              <View style={styles.card}>
                <TotpSetup onDone={refreshMfa} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>{t('Enter your code')}</Text>
              <Text style={[styles.text, { marginBottom: 18 }]}>
                {t('Open your authenticator app and type the 6-digit code for Kuova Health.')}
              </Text>
              <TextInput
                style={totpStyles.codeInput}
                value={code}
                onChangeText={(v) => setCode(cleanTotpCode(v))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                placeholder="123456"
                placeholderTextColor={Colors.textMuted}
                maxLength={7}
                autoFocus
                editable={!busy}
                onSubmitEditing={() => isTotpCodeComplete(code) && verify()}
              />
              {error ? <Text style={totpStyles.error}>{error}</Text> : null}
              <TouchableOpacity
                style={[totpStyles.button, (!isTotpCodeComplete(code) || busy) && totpStyles.buttonDisabled]}
                onPress={verify}
                disabled={!isTotpCodeComplete(code) || busy}
              >
                {busy ? <ActivityIndicator color={Colors.background} /> : <Text style={totpStyles.buttonText}>{t('Continue')}</Text>}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.link} onPress={() => setLostOpen((v) => !v)}>
            <Text style={styles.linkText}>{t('Lost your phone?')}</Text>
          </TouchableOpacity>
          {lostOpen && (
            <Text style={styles.help}>
              {t('Write to support@kuovahealth.com from your account email. Once we have checked it is you, we remove the old app and you add a new one when you sign in.')}
            </Text>
          )}

          <TouchableOpacity style={styles.link} onPress={logout}>
            <Text style={styles.signOut}>
              {t('Sign out')}
              {user?.email ? ` · ${user.email}` : ''}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.cosmicBase },
  content: { flexGrow: 1, justifyContent: 'center', padding: 20, width: '100%', maxWidth: 460, alignSelf: 'center' },
  header: { alignItems: 'center', marginBottom: 26, gap: 14 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: withAlpha(Colors.accent, 0.12),
  },
  badgeText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  text: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 4 },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: withAlpha(Colors.card, 0.85),
  },
  link: { alignSelf: 'center', marginTop: 20, paddingVertical: 6 },
  linkText: { color: Colors.accent, fontSize: 14, textDecorationLine: 'underline' },
  help: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 4, textAlign: 'center' },
  signOut: { color: Colors.textMuted, fontSize: 13 },
});
