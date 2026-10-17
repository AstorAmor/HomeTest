import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { t } from '@/i18n';

// "Tu nombre": el alias con el que te saluda Kuova ("¡Hola, Astor!") y el que ven los
// profesionales con los que compartes. Cualquier cuenta puede cambiarlo cuando quiera. Se llega
// desde Mi perfil (lápiz), Ajustes → Cuenta y, si aún no hay alias, desde el saludo de Today.
export const YourNameScreen = () => {
  const router = useRouter();
  const { user, updateDisplayName } = useAuth();
  const emailName = user?.email?.split('@')[0] ?? '';
  // Sin alias, el nombre es la parte del email: el campo empieza vacío
  const current = user?.nombre && user.nombre !== emailName ? user.nombre : '';
  const [name, setName] = useState(current);
  const [touched, setTouched] = useState(false);
  // Si la sesión termina de cargar con la pantalla ya abierta, se rellena con el alias actual
  useEffect(() => {
    if (!touched) setName(current);
  }, [current, touched]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      await updateDisplayName(name);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not save your name'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={t('Your name')} showBack backFallback="/profile" />
        <View style={styles.card}>
          <Text style={styles.label}>{t('How should we call you?')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(v) => {
              setTouched(true);
              setName(v);
            }}
            placeholder={t('Your name or a nickname')}
            placeholderTextColor={Colors.textMuted}
            autoFocus
            maxLength={40}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={save}
          />
          <View style={styles.preview}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.previewText}>{t('Hi {name}!', { name: (name.trim() || emailName).split(/\s+/)[0] })}</Text>
          </View>
          <Text style={styles.help}>{t('This is how Kuova greets you, and the name professionals see when you share your data with them. You can change it whenever you like.')}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={[styles.cta, (!name.trim() || busy) && styles.ctaOff]} onPress={save} disabled={!name.trim() || busy}>
            {busy ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.ctaText}>{t('Save')}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  card: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  label: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  input: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    backgroundColor: Colors.background,
  },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
  help: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  error: { color: Colors.attention, fontSize: 13 },
  cta: { backgroundColor: Colors.accent, borderRadius: 24, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  ctaOff: { opacity: 0.45 },
  ctaText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
});
