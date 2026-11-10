import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { Colors, withAlpha } from '@/constants/colors';
import { CosmicBackground } from '@/components/CosmicBackground';
import { KuovaWordmark } from '@/components/KuovaLogo';
import { LanguagePicker } from '@/components/LanguagePicker';
import { Ionicons } from '@expo/vector-icons';
import { PROFESSIONAL_ROLES, ProfessionalRole } from '@/data/sharing';
import { isPublicDemo } from '@/lib/supabase';
import { t } from '@/i18n';
import { PasswordInput } from '@/components/PasswordInput';
import { isStagingApp, isTestDatabase } from '@/lib/appVariant';
import { cleanTotpCode, isTotpCodeComplete } from '@/logic/mfa';
import { PASSWORD_RULES, isPasswordStrongEnough, passwordRuleFromAuthError, passwordRuleMet, type PasswordRule } from '@/logic/password';

// Reglas de la contraseña (las mismas que Supabase: config.toml y logic/password.ts)
const RULE_LABEL: Record<PasswordRule, string> = {
  length: 'At least 8 characters',
  letter: 'One letter (a-z)',
  digit: 'One number',
};

// Los errores de Supabase llegan en inglés: los más comunes, en el idioma de la app
const authMessage = (m: string) => {
  if (/invalid login credentials/i.test(m)) return t('Wrong email or password.');
  if (/email not confirmed/i.test(m)) return t('Confirm your email first: open the message we sent you.');
  if (/already registered|already exists/i.test(m)) return t('There is already an account with this email. Sign in instead.');
  if (passwordRuleFromAuthError(m)) return t('The password needs at least 8 characters, with letters (a-z) and numbers.');
  if (/only request this after|rate limit|too many/i.test(m)) return t('Wait a minute before asking for another email.');
  if (/token has expired|otp.*(invalid|expired)|invalid.*otp/i.test(m))
    return t('That code is not right or has expired. Check the latest email or ask for a new one.');
  return m;
};

const RESEND_SECONDS = 60;

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState(''); // al crear la cuenta: repetirla
  const [sentTo, setSentTo] = useState<string | null>(null); // correo de confirmación enviado
  const [isSignUp, setIsSignUp] = useState(false);
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // «Acceso profesionales»: entrar al portal o darse de alta como profesional sanitario. El alta necesita
  // Supabase (cuenta real); en la demo, entrar lleva al portal de ejemplo
  const [proAccess, setProAccess] = useState(false);
  const [proRole, setProRole] = useState<ProfessionalRole>('doctor');
  const [specialty, setSpecialty] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  const { login, signup, authMode, setDemoMode, verifySignupCode, resendSignupEmail } = useAuth();
  const isProfessional = proAccess && authMode === 'supabase';
  // «Revisa tu correo»: código de 6 cifras del correo y reenvío (con espera de 1 minuto, como Supabase)
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [info, setInfo] = useState('');
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const showConfirm = (to: string) => {
    setSentTo(to);
    setCode('');
    setInfo('');
    setError('');
  };

  const confirmCode = async () => {
    if (!sentTo) return;
    setError('');
    setLoading(true);
    try {
      // Con el código bueno queda la sesión iniciada: AuthContext lleva a la app
      await verifySignupCode(sentTo, code);
    } catch (err) {
      setError(err instanceof Error ? authMessage(err.message) : t('Authentication error'));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!sentTo || cooldown > 0) return;
    setError('');
    setInfo('');
    try {
      await resendSignupEmail(sentTo);
      setInfo(t('Sent again. It can take a minute; look in spam or promotions too.'));
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? authMessage(err.message) : t('Authentication error'));
    }
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      // En la demo no hay fichas de profesional: el modo del portal se elige aquí (como en el selector)
      if (proAccess && authMode === 'demo') setDemoMode('pro');
      if (isSignUp) {
        if (!nombre.trim()) {
          setError(t('Please enter your name'));
          setLoading(false);
          return;
        }
        if (authMode === 'supabase' && !isPasswordStrongEnough(password)) {
          setError(t('The password needs at least 8 characters, with letters (a-z) and numbers.'));
          setLoading(false);
          return;
        }
        if (password !== password2) {
          setError(t('The two passwords do not match.'));
          setLoading(false);
          return;
        }
        const result = await signup(
          email,
          password,
          nombre,
          isProfessional
            ? { role: proRole, specialty: specialty.trim(), licenseNumber: licenseNumber.trim() }
            : undefined
        );
        if (result === 'confirm_email') {
          // Cuenta creada: falta confirmar el correo (código de 6 cifras o el botón del correo)
          setIsSignUp(false);
          setPassword('');
          setPassword2('');
          showConfirm(email.trim());
          setCooldown(RESEND_SECONDS);
        }
      } else {
        await login(email, password);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      // Cuenta sin confirmar: directamente a «Revisa tu correo», con el reenvío a mano
      if (/email not confirmed/i.test(message)) {
        showConfirm(email.trim());
        return;
      }
      setError(message ? authMessage(message) : t('Authentication error'));
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = email && password && (!isSignUp || (nombre && password2));
  const showRules = isSignUp && authMode === 'supabase';

  return (
    <SafeAreaView style={styles.safeArea}>
      <CosmicBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* El idioma arriba del todo, separado de la marca; el resto queda centrado en el hueco que sobra */}
          <LanguagePicker />
          <View style={styles.spacer} />
          <View style={styles.header}>
            <View accessible accessibilityRole="header" accessibilityLabel={t('Kuova Health')}>
              <KuovaWordmark height={34} color={Colors.isLight ? Colors.accent : Colors.textPrimary} />
            </View>
            <Text style={styles.health}>{t('HEALTH')}</Text>
            <Text style={styles.subtitle}>{proAccess ? t('Professional access') : t('Know more. Live better.')}</Text>
            {(isStagingApp || isTestDatabase) && (
              <View style={styles.testBadge}>
                <Ionicons name="flask-outline" size={14} color="#FFFFFF" />
                <Text style={styles.testBadgeText}>{t('TEST ENVIRONMENT · invented data only')}</Text>
              </View>
            )}
            {proAccess && (
              <Text style={styles.proIntro}>
                {t('For doctors, nutritionists and other health professionals: see what your patients choose to share with you.')}
              </Text>
            )}
          </View>

          {sentTo ? (
            <View style={styles.form}>
              <View style={styles.sent}>
                <Ionicons name="mail-outline" size={20} color={Colors.ok} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sentTitle}>{t('Check your email')}</Text>
                  <Text style={styles.sentText}>
                    {t('We have sent an email to {email}. Type the 6-digit code from the email here, or tap «Confirm my email» in it and then sign in.', { email: sentTo })}
                  </Text>
                </View>
              </View>
              <Text style={styles.label}>{t('Code from the email')}</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={(v) => setCode(cleanTotpCode(v))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                placeholder="123456"
                placeholderTextColor={Colors.textMuted}
                maxLength={7}
                editable={!loading}
                onSubmitEditing={() => isTotpCodeComplete(code) && confirmCode()}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {info ? <Text style={styles.info}>{info}</Text> : null}
              <TouchableOpacity
                style={[styles.button, (!isTotpCodeComplete(code) || loading) && styles.buttonDisabled]}
                onPress={confirmCode}
                disabled={!isTotpCodeComplete(code) || loading}
              >
                {loading ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.buttonText}>{t('Confirm')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={resend} disabled={cooldown > 0}>
                <Text style={[styles.toggleText, cooldown > 0 && styles.toggleTextWaiting]}>
                  {cooldown > 0 ? t('You can ask for another email in {s} s.', { s: cooldown }) : t('Send the email again')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setEmail(sentTo);
                  setSentTo(null);
                  setError('');
                  setInfo('');
                }}
              >
                <Text style={styles.toggleText}>{t('I have confirmed it: sign in')}</Text>
              </TouchableOpacity>
              <Text style={styles.proNote}>{t('Not arriving? Look in spam or promotions.')}</Text>
            </View>
          ) : (
          <View style={styles.form}>
            {isSignUp && (
              <>
                <Text style={styles.label}>{t('Full name')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('John Smith')}
                  placeholderTextColor={Colors.textMuted}
                  value={nombre}
                  onChangeText={setNombre}
                  editable={!loading}
                />

                {isProfessional && (
                  <View style={styles.proBox}>
                    <Text style={[styles.label, { marginTop: 0 }]}>{t('Profession')}</Text>
                    <View style={styles.roleChips}>
                      {PROFESSIONAL_ROLES.map((r) => (
                        <TouchableOpacity
                          key={r.id}
                          style={[styles.roleChip, proRole === r.id && styles.roleChipSelected]}
                          onPress={() => setProRole(r.id)}
                        >
                          <Text style={[styles.roleChipText, proRole === r.id && styles.roleChipTextSelected]}>
                            {r.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.label}>{t('Specialty (optional)')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t('e.g. Internal medicine')}
                      placeholderTextColor={Colors.textMuted}
                      value={specialty}
                      onChangeText={setSpecialty}
                      editable={!loading}
                    />
                    <Text style={styles.label}>{t('License / registration number')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t('Registration number')}
                      placeholderTextColor={Colors.textMuted}
                      value={licenseNumber}
                      onChangeText={setLicenseNumber}
                      editable={!loading}
                    />
                    <Text style={styles.proNote}>
                      {t('Kuova verifies every professional before patients can share data with them.')}
                    </Text>
                  </View>
                )}
              </>
            )}

            <Text style={styles.label}>{t('Email')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('you@email.com')}
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType={isSignUp ? 'emailAddress' : 'username'}
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />

            <Text style={styles.label}>{t('Password')}</Text>
            <PasswordInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              editable={!loading}
              textContentType={isSignUp ? 'newPassword' : 'password'}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
            {showRules && (
              <View style={styles.rules}>
                {PASSWORD_RULES.map((r) => {
                  const ok = passwordRuleMet(r, password);
                  return (
                    <View key={r} style={styles.rule}>
                      <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={ok ? Colors.ok : Colors.textMuted} />
                      <Text style={[styles.ruleText, ok && styles.ruleTextOk]}>{t(RULE_LABEL[r])}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            {isSignUp && (
              <>
                <Text style={styles.label}>{t('Repeat your password')}</Text>
                <PasswordInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textMuted}
                  value={password2}
                  onChangeText={setPassword2}
                  editable={!loading}
                  textContentType="newPassword"
                  autoComplete="new-password"
                />
              </>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, !isFormValid && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={!isFormValid || loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.background} />
              ) : (
                <Text style={styles.buttonText}>
                  {isSignUp ? t('Create account') : t('Sign in')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setSentTo(null);
              }}
              disabled={loading}
            >
              <Text style={styles.toggleText}>
                {isSignUp
                  ? t('Already have an account? Sign in')
                  : t("Don't have an account? Create one")}
              </Text>
            </TouchableOpacity>

            {/* Médicos y demás profesionales: su propia entrada (el portal de pacientes que les comparten) */}
            {!isPublicDemo && (
              <TouchableOpacity
                style={styles.proLink}
                onPress={() => {
                  setProAccess(!proAccess);
                  setError('');
                  setSentTo(null);
                }}
                disabled={loading}
                accessibilityRole="button"
              >
                <Ionicons name={proAccess ? 'person-outline' : 'medkit-outline'} size={16} color={Colors.accent} />
                <Text style={styles.proLinkText}>{proAccess ? t('Patient access') : t('Professional access')}</Text>
              </TouchableOpacity>
            )}
          </View>
          )}

          <View style={[styles.demoHint, authMode !== 'demo' && styles.privacyHint]}>
            <Ionicons
              name={authMode === 'demo' ? 'information-circle-outline' : 'lock-closed-outline'}
              size={16}
              color={authMode === 'demo' ? Colors.warning : Colors.accent}
            />
            <Text style={styles.demoText}>
              {authMode === 'demo' ? t('Demo mode: use any email/password') : t('Your data is private to your account')}
            </Text>
          </View>
          <View style={styles.spacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.cosmicBase,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    // En la web ancha, el formulario no ocupa toda la pantalla
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  spacer: {
    flexGrow: 1,
    minHeight: 28,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  // "HEALTH" bajo el logotipo, espaciado y en Gold (como en la guía de marca)
  health: {
    marginTop: 10,
    marginBottom: 18,
    paddingLeft: 7,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 7,
    color: '#C9A36B',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  form: {
    marginBottom: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: 16,
  },
  sent: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: withAlpha(Colors.ok, 0.12), borderRadius: 10, padding: 12, marginTop: 14 },
  sentText: { flex: 1, color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },
  sentTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  codeInput: { fontSize: 22, letterSpacing: 8, textAlign: 'center' },
  info: { color: Colors.ok, fontSize: 13, marginTop: 10, paddingHorizontal: 8, lineHeight: 19 },
  rules: { marginTop: 8, gap: 4, paddingHorizontal: 4 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleText: { color: Colors.textMuted, fontSize: 13 },
  ruleTextOk: { color: Colors.textPrimary },
  toggleTextWaiting: { color: Colors.textMuted, textDecorationLine: 'none' },
  testBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#D6621E',
  },
  testBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
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
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    backgroundColor: Colors.cardBorder,
  },
  buttonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  toggleText: {
    color: Colors.accent,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    textDecorationLine: 'underline',
  },
  error: {
    color: Colors.danger,
    fontSize: 14,
    marginTop: 12,
    paddingHorizontal: 8,
  },
  proIntro: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 320,
  },
  proLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 22,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: withAlpha(Colors.accent, 0.35),
  },
  proLinkText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  proBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha(Colors.accent, 0.35),
    backgroundColor: withAlpha(Colors.card, 0.72),
  },
  roleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  roleChipSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  roleChipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  roleChipTextSelected: {
    color: Colors.textPrimary,
  },
  proNote: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
  demoHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: withAlpha(Colors.card, 0.72),
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  privacyHint: { borderLeftColor: Colors.accent },
  demoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
