import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TotpSetup } from '@/components/TotpSetup';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { isMfaRequired, listTotpFactors, removeTotpFactor, type TotpFactor } from '@/data/mfa';
import { dateLocale, t } from '@/i18n';

// Ajustes → Verificación en dos pasos. Opcional para pacientes; obligatoria (al menos una app) para
// admins, profesionales y soporte. Se pueden tener varias apps a la vez: si pierdes el móvil, la otra vale.
export const SecurityScreen = () => {
  const { refreshMfa } = useAuth();
  const [factors, setFactors] = useState<TotpFactor[] | null>(null);
  const [required, setRequired] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, req] = await Promise.all([listTotpFactors(), isMfaRequired()]);
      setFactors(list);
      setRequired(req);
    } catch (e) {
      setError(e instanceof Error ? e.message : '');
      setFactors([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const remove = async (f: TotpFactor) => {
    const ok = await confirmAsk(t('Remove this app?'), t('You will no longer be asked for its codes.'), t('Remove'));
    if (!ok) return;
    setError('');
    try {
      await removeTotpFactor(f.id);
      await load();
      await refreshMfa();
    } catch (e) {
      setError(e instanceof Error ? e.message : '');
    }
  };

  const on = (factors?.length ?? 0) > 0;
  const canRemove = !required || (factors?.length ?? 0) > 1;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={t('Two-step verification')} showBack backFallback="/settings" />

        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Ionicons name={on ? 'shield-checkmark' : 'shield-outline'} size={26} color={on ? Colors.ok : Colors.textSecondary} />
            <Text style={styles.status}>{factors === null ? '' : on ? t('On') : t('Off')}</Text>
          </View>
          <Text style={styles.text}>
            {required
              ? t('Your account can see patient data, so it needs it: when you sign in, Kuova asks for a 6-digit code from your authenticator app.')
              : t('Add a second step when you sign in: a 6-digit code from an authenticator app. Then nobody can open your account with only your password.')}
          </Text>
        </View>

        {factors === null ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
        ) : (
          <>
            {on && (
              <>
                <Text style={styles.section}>{t('Your authenticator apps')}</Text>
                <View style={styles.card}>
                  {factors.map((f, i) => (
                    <View key={f.id} style={[styles.row, i > 0 && styles.divider]}>
                      <Ionicons name="phone-portrait-outline" size={20} color={Colors.accent} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{f.name || t('Authenticator app')}</Text>
                        <Text style={styles.rowSub}>
                          {t('Added {date}', { date: new Date(f.createdAt).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) })}
                        </Text>
                      </View>
                      {canRemove && (
                        <TouchableOpacity onPress={() => remove(f)} hitSlop={8}>
                          <Text style={styles.remove}>{t('Remove')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  {!canRemove && (
                    <Text style={styles.note}>
                      {t('Your account needs at least one: to change it, add the new app first and then remove the old one.')}
                    </Text>
                  )}
                </View>
              </>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {adding ? (
              <View style={[styles.card, { marginTop: 18, padding: 16 }]}>
                <TotpSetup
                  onDone={async () => {
                    setAdding(false);
                    await load();
                    await refreshMfa();
                  }}
                />
              </View>
            ) : (
              <TouchableOpacity style={styles.addButton} onPress={() => setAdding(true)}>
                <Ionicons name="add-circle-outline" size={20} color={Colors.background} />
                <Text style={styles.addText}>{on ? t('Add another app') : t('Turn on two-step verification')}</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.footer}>
              {t('Lost your phone? Write to support@kuovahealth.com from your account email. Once we have checked it is you, we remove the old app and you add a new one when you sign in.')}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  section: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700', marginHorizontal: 20, marginTop: 18, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { marginHorizontal: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, overflow: 'hidden' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 16 },
  status: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  text: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, padding: 16, paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  divider: { borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  rowTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  rowSub: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
  remove: { color: Colors.danger, fontSize: 14, fontWeight: '700' },
  note: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, paddingHorizontal: 16, paddingBottom: 14 },
  error: { color: Colors.danger, fontSize: 14, marginHorizontal: 20, marginTop: 12 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 18,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
  },
  addText: { color: Colors.background, fontSize: 15, fontWeight: '700' },
  footer: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, marginHorizontal: 20, marginTop: 20 },
});
