import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { FButton, formStyles } from '@/components/fine/FineForm';
import { settingsStyles } from '@/components/settings/SettingsParts';
import { useAuth } from '@/context/AuthContext';
import { t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// "Tu nombre": el alias con el que te saluda Kuova ("¡Hola, Ana!") y el que ven los
// profesionales con los que compartes. Cualquier cuenta puede cambiarlo cuando quiera. Se llega
// desde Mi perfil (lápiz), Ajustes → Cuenta y, si aún no hay alias, desde el saludo de Today.
// Desde el 2026-11-17, en el lenguaje fino de Ajustes: la pregunta, la casilla casi transparente, el saludo tal como
// saldrá (sin icono) y el botón esmeralda a todo el ancho; sin tarjeta.
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
        <View style={settingsStyles.body}>
          <Text style={formStyles.q}>{t('How should we call you?')}</Text>
          <TextInput
            style={[formStyles.input, styles.input]}
            value={name}
            onChangeText={(v) => {
              setTouched(true);
              setName(v);
            }}
            placeholder={t('Your name or a nickname')}
            placeholderTextColor={FINE.mute}
            autoFocus
            maxLength={40}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={save}
          />
          {/* El saludo tal como sale en Hoy */}
          <Text style={styles.preview}>{t('Hi {name}!', { name: (name.trim() || emailName).split(/\s+/)[0] })}</Text>
          <Text style={fine.note}>{t('This is how Kuova greets you, and the name professionals see when you share your data with them. You can change it whenever you like.')}</Text>
          {error ? <Text style={[formStyles.error, styles.error]}>{error}</Text> : null}
          <FButton label={t('Save')} onPress={save} disabled={!name.trim()} busy={busy} style={styles.save} />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  input: { ...ff('medium'), fontSize: 18, paddingHorizontal: 14, paddingVertical: 12, marginTop: 14 },
  preview: { ...ff('light'), color: FINE.ivory, fontSize: 22, lineHeight: 28, marginTop: 16 },
  error: { marginTop: 10 },
  save: { marginTop: 20 },
});
