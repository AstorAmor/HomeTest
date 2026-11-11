import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/colors';
import { CosmicBackground } from '@/components/CosmicBackground';
import { KuovaWordmark } from '@/components/KuovaLogo';
import { PasswordInput } from '@/components/PasswordInput';
import { PasswordRules } from '@/components/PasswordRules';
import { useAuth } from '@/context/AuthContext';
import { clearPasswordResetPending } from '@/data/passwordReset';
import { isPasswordStrongEnough, passwordRuleFromAuthError } from '@/logic/password';
import { t } from '@/i18n';

type Problem = '' | 'same' | 'weak' | 'mismatch' | 'session' | 'other';

// «Elige una contraseña nueva» tras «¿Has olvidado tu contraseña?» (la pone PasswordResetGuard delante de
// toda la app). La sesión ya está abierta con el código del correo.
export const NewPasswordScreen = () => {
  const { setNewPassword, logout, user } = useAuth();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>('');
  const [done, setDone] = useState(false);

  const save = async () => {
    if (!isPasswordStrongEnough(password)) return setProblem('weak');
    if (password !== password2) return setProblem('mismatch');
    setBusy(true);
    setProblem('');
    try {
      await setNewPassword(password);
      setDone(true);
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      if (/different from the old|same_password/i.test(m)) setProblem('same');
      else if (passwordRuleFromAuthError(m) || /weak/i.test(m)) setProblem('weak');
      else if (/session|jwt|expired|not authenticated/i.test(m)) setProblem('session');
      else setProblem('other');
    } finally {
      setBusy(false);
    }
  };

  const message: Record<Exclude<Problem, ''>, string> = {
    same: t('That is already your password. You can keep it, or choose a different one.'),
    weak: t('The password needs at least 8 characters, with letters (a-z) and numbers.'),
    mismatch: t('The two passwords do not match.'),
    session: t('Your session has ended. Sign out and ask for a new code.'),
    other: t('Could not save it. Try again in a moment.'),
  };

  const ready = password.length > 0 && password2.length > 0 && !busy;

  return (
    <SafeAreaView style={styles.safeArea}>
      <CosmicBackground />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <KuovaWordmark height={28} color={Colors.isLight ? Colors.accent : Colors.textPrimary} />
            <View style={styles.badge}>
              <Ionicons name="key-outline" size={18} color={Colors.accent} />
              <Text style={styles.badgeText}>{t('New password')}</Text>
            </View>
          </View>

          {done ? (
            <>
              <View style={styles.doneRow}>
                <Ionicons name="checkmark-circle" size={26} color={Colors.ok} />
                <Text style={styles.title}>{t('Password changed')}</Text>
              </View>
              <Text style={[styles.text, { marginBottom: 6 }]}>{t('From now on, sign in with your new password.')}</Text>
              <TouchableOpacity style={styles.button} onPress={() => clearPasswordResetPending()}>
                <Text style={styles.buttonText}>{t('Continue')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>{t('Choose a new password')}</Text>
              <Text style={[styles.text, { marginBottom: 6 }]}>
                {t('You are in. Choose a new password for {email}: from now on you will sign in with it.', { email: user?.email ?? '' })}
              </Text>

              <Text style={styles.label}>{t('New password')}</Text>
              <PasswordInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setProblem('');
                }}
                editable={!busy}
                textContentType="newPassword"
                autoComplete="new-password"
                autoFocus
              />
              <PasswordRules password={password} />
              <Text style={styles.label}>{t('Repeat your password')}</Text>
              <PasswordInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                value={password2}
                onChangeText={(v) => {
                  setPassword2(v);
                  setProblem('');
                }}
                editable={!busy}
                textContentType="newPassword"
                autoComplete="new-password"
                onSubmitEditing={() => ready && save()}
              />

              {problem ? <Text style={styles.error}>{message[problem]}</Text> : null}
              {problem === 'same' && (
                <TouchableOpacity style={styles.link} onPress={() => clearPasswordResetPending()}>
                  <Text style={styles.linkText}>{t('Keep my current password')}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[styles.button, !ready && styles.buttonDisabled]} onPress={save} disabled={!ready}>
                {busy ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.buttonText}>{t('Save password')}</Text>}
              </TouchableOpacity>
            </>
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
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 4 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: withAlpha(Colors.card, 0.72),
  },
  button: { backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { backgroundColor: Colors.cardBorder },
  buttonText: { color: Colors.background, fontSize: 16, fontWeight: '700' },
  error: { color: Colors.danger, fontSize: 14, marginTop: 10, lineHeight: 20 },
  link: { alignSelf: 'center', marginTop: 20, paddingVertical: 6 },
  linkText: { color: Colors.accent, fontSize: 14, textDecorationLine: 'underline' },
  signOut: { color: Colors.textMuted, fontSize: 13 },
});
