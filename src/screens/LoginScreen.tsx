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
import { Ionicons } from '@expo/vector-icons';
import { PROFESSIONAL_ROLES, ProfessionalRole } from '@/data/sharing';

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Alta como profesional sanitario (solo con Supabase: necesita cuenta real)
  const [isProfessional, setIsProfessional] = useState(false);
  const [proRole, setProRole] = useState<ProfessionalRole>('doctor');
  const [specialty, setSpecialty] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  const { login, signup, authMode } = useAuth();

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (!nombre.trim()) {
          setError('Please enter your name');
          setLoading(false);
          return;
        }
        await signup(
          email,
          password,
          nombre,
          isProfessional
            ? { role: proRole, specialty: specialty.trim(), licenseNumber: licenseNumber.trim() }
            : undefined
        );
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = email && password && (!isSignUp || nombre);

  return (
    <SafeAreaView style={styles.safeArea}>
      <CosmicBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>HomeTest</Text>
            <Text style={styles.subtitle}>At-home medical tests</Text>
          </View>

          <View style={styles.form}>
            {isSignUp && (
              <>
                <Text style={styles.label}>Full name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Smith"
                  placeholderTextColor={Colors.textMuted}
                  value={nombre}
                  onChangeText={setNombre}
                  editable={!loading}
                />

                {authMode === 'supabase' && (
                  <TouchableOpacity
                    style={styles.proToggle}
                    onPress={() => setIsProfessional(!isProfessional)}
                    disabled={loading}
                  >
                    <Ionicons
                      name={isProfessional ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={isProfessional ? Colors.accent : Colors.textSecondary}
                    />
                    <Text style={styles.proToggleText}>I'm a healthcare professional</Text>
                  </TouchableOpacity>
                )}

                {isProfessional && (
                  <View style={styles.proBox}>
                    <Text style={[styles.label, { marginTop: 0 }]}>Profession</Text>
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
                    <Text style={styles.label}>Specialty (optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Internal medicine"
                      placeholderTextColor={Colors.textMuted}
                      value={specialty}
                      onChangeText={setSpecialty}
                      editable={!loading}
                    />
                    <Text style={styles.label}>License / registration number</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Nº de colegiado"
                      placeholderTextColor={Colors.textMuted}
                      value={licenseNumber}
                      onChangeText={setLicenseNumber}
                      editable={!loading}
                    />
                    <Text style={styles.proNote}>
                      HomeTest verifies every professional before patients can share data with them.
                    </Text>
                  </View>
                )}
              </>
            )}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@email.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />

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
                  {isSignUp ? 'Create account' : 'Sign in'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              disabled={loading}
            >
              <Text style={styles.toggleText}>
                {isSignUp
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Create one"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.demoHint}>
            <Text style={styles.demoText}>
              {authMode === 'demo'
                ? '💡 Demo mode: use any email/password'
                : '🔒 Your data is private to your account'}
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
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
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
  proToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  proToggleText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
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
    backgroundColor: withAlpha(Colors.card, 0.72),
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  demoText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
