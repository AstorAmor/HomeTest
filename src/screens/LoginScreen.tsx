import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { PROFESSIONAL_ROLES, ProfessionalRole } from '@/data/sharing';
import { isPublicDemo } from '@/lib/supabase';
import { t } from '@/i18n';
import { PasswordInput } from '@/components/PasswordInput';

// Los errores de Supabase llegan en inglés: los más comunes, en el idioma de la app
const authMessage = (m: string) =>
  /invalid login credentials/i.test(m)
    ? t('Wrong email or password.')
    : /email not confirmed/i.test(m)
      ? t('Confirm your email first: open the message we sent you.')
      : /already registered|already exists/i.test(m)
        ? t('There is already an account with this email. Sign in instead.')
        : /password should be at least/i.test(m)
          ? t('The password needs at least 6 characters.')
          : m;

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

  const { login, signup, authMode, setDemoMode } = useAuth();
  const isProfessional = proAccess && authMode === 'supabase';

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
          // Cuenta creada: a iniciar sesión cuando confirme el correo
          setSentTo(email.trim());
          setIsSignUp(false);
          setPassword('');
          setPassword2('');
        }
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? authMessage(err.message) : t('Authentication error'));
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = email && password && (!isSignUp || (nombre && password2));

  return (
    <SafeAreaView style={styles.safeArea}>
      <CosmicBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View accessible accessibilityRole="header" accessibilityLabel={t('Kuova Health')}>
              <KuovaWordmark height={34} color={Colors.isLight ? Colors.accent : Colors.textPrimary} />
            </View>
            <Text style={styles.health}>{t('HEALTH')}</Text>
            <Text style={styles.subtitle}>{proAccess ? t('Professional access') : t('Know more. Live better.')}</Text>
            {proAccess && (
              <Text style={styles.proIntro}>
                {t('For doctors, nutritionists and other health professionals: see what your patients choose to share with you.')}
              </Text>
            )}
          </View>

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
            />
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
                />
              </>
            )}

            {sentTo && !isSignUp ? (
              <View style={styles.sent}>
                <Ionicons name="mail-outline" size={18} color={Colors.ok} />
                <Text style={styles.sentText}>
                  {t('We have sent an email to {email}. Open it to confirm your account, then sign in here.', { email: sentTo })}
                </Text>
              </View>
            ) : null}

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
