import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { Colors } from '@/constants/colors';
import { redeemAccessCode, tierName, Tier } from '@/data/access';
import { dateLocale, t } from '@/i18n';

// "¿Tienes un código de invitación?": Kuova da códigos (amigos, pruebas) que abren lo de una
// suscripción sin pagar, durante un tiempo o sin fin. Los crea el admin en Más → Suscripciones.
export const RedeemCodeScreen = () => {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ tier: Tier; expiresAt: string | null } | null>(null);

  const redeem = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setError('');
    try {
      setDone(await redeemAccessCode(code));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={t('Invitation code')} showBack backFallback="/subscription" />

        {done ? (
          <View style={styles.card}>
            <View style={styles.okIcon}>
              <Ionicons name="checkmark" size={28} color={Colors.background} />
            </View>
            <Text style={styles.title}>{t('Code accepted')}</Text>
            <Text style={styles.text}>
              {done.expiresAt
                ? t('You have everything in {plan} until {date}.', {
                    plan: tierName(done.tier),
                    date: new Date(done.expiresAt).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }),
                  })
                : t('You have everything in {plan}, with no end date.', { plan: tierName(done.tier) })}
            </Text>
            <TouchableOpacity style={styles.cta} onPress={() => router.replace('/upload-test')}>
              <Text style={styles.ctaText}>{t('Scan a lab report')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.link}>{t('Done')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.text}>{t('If Kuova gave you a code, type it here to unlock what a subscription includes.')}</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              placeholder="KUOVA-XXXXXX"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={redeem}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity style={[styles.cta, (!code.trim() || busy) && styles.ctaDisabled]} onPress={redeem} disabled={!code.trim() || busy}>
              {busy ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.ctaText}>{t('Use code')}</Text>}
            </TouchableOpacity>
          </View>
        )}
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
    gap: 14,
    alignItems: 'stretch',
  },
  okIcon: { alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  text: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    backgroundColor: Colors.background,
  },
  error: { color: Colors.attention, fontSize: 13, lineHeight: 18 },
  cta: { backgroundColor: Colors.accent, borderRadius: 24, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: Colors.background, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  link: { color: Colors.accent, fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
