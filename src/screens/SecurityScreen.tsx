import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TotpSetup } from '@/components/TotpSetup';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { SecHead } from '@/components/fine/Fine';
import { FButton, formStyles } from '@/components/fine/FineForm';
import { settingsStyles } from '@/components/settings/SettingsParts';
import { useAuth } from '@/context/AuthContext';
import { isMfaRequired, listTotpFactors, removeTotpFactor, type TotpFactor } from '@/data/mfa';
import { dateLocale, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Ajustes → Verificación en dos pasos. Opcional para pacientes; obligatoria (al menos una app) para
// admins, profesionales y soporte. Se pueden tener varias apps a la vez: si pierdes el móvil, la otra vale.
// Desde el 2026-11-17, en el lenguaje fino de Ajustes: el estado en una palabra grande y ligera (jade si está
// activada) en lugar del escudo, las apps en filas con línea fina, «Quitar» apagado (sin rojo) y el botón esmeralda.
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
      {/* Que el teclado no tape la casilla del código al dar de alta la app de autenticación */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={t('Two-step verification')} showBack backFallback="/settings" />

        <View style={settingsStyles.body}>
          <Text style={[styles.status, on && styles.statusOn]}>{factors === null ? ' ' : on ? t('On') : t('Off')}</Text>
          <Text style={styles.text}>
            {required
              ? t('Your account can see patient data, so it needs it: when you sign in, Kuova asks for a 6-digit code from your authenticator app.')
              : t('Add a second step when you sign in: a 6-digit code from an authenticator app. Then nobody can open your account with only your password.')}
          </Text>

          {factors === null ? (
            <ActivityIndicator color={FINE.jade} style={{ marginTop: 24 }} />
          ) : (
            <>
              {on && (
                <>
                  <SecHead title={t('Your authenticator apps')} />
                  {factors.map((f, i) => (
                    <View key={f.id} style={[fine.row, i === factors.length - 1 && settingsStyles.noLine]}>
                      <View style={styles.flex}>
                        <Text style={fine.rowTitle}>{f.name || t('Authenticator app')}</Text>
                        <Text style={fine.rowSub}>
                          {t('Added {date}', { date: new Date(f.createdAt).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) })}
                        </Text>
                      </View>
                      {canRemove && (
                        <TouchableOpacity onPress={() => remove(f)} hitSlop={8} style={styles.removeButton} accessibilityRole="button">
                          <Text style={styles.remove}>{t('Remove')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  {!canRemove && (
                    <Text style={fine.note}>
                      {t('Your account needs at least one: to change it, add the new app first and then remove the old one.')}
                    </Text>
                  )}
                </>
              )}

              {error ? <Text style={[formStyles.error, styles.error]}>{error}</Text> : null}

              {adding ? (
                <View style={styles.setup}>
                  <TotpSetup
                    onDone={async () => {
                      setAdding(false);
                      await load();
                      await refreshMfa();
                    }}
                  />
                </View>
              ) : (
                <FButton label={on ? t('Add another app') : t('Turn on two-step verification')} onPress={() => setAdding(true)} style={styles.add} />
              )}

              <Text style={styles.footer}>
                {t('Lost your phone? Write to support@kuovahealth.com from your account email. Once we have checked it is you, we remove the old app and you add a new one when you sign in.')}
              </Text>
            </>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0 },
  // «Activada» / «Desactivada»: grande y ligera, como las cifras; activada, en jade
  status: { ...ff('light'), color: FINE.ivory, fontSize: 32, lineHeight: 38, marginTop: 4 },
  statusOn: { color: FINE.jade },
  text: { ...ff('regular'), color: FINE.mute, fontSize: 14, lineHeight: 20, marginTop: 6 },
  removeButton: { minHeight: 36, justifyContent: 'center' },
  remove: { ...ff('regular'), color: FINE.mute, fontSize: 14 },
  error: { marginTop: 12 },
  // El alta de la app de autenticación, debajo de una raya fina (sin tarjeta)
  setup: { marginTop: 22, paddingTop: 16, borderTopWidth: 1, borderTopColor: FINE.rule },
  add: { marginTop: 22 },
  footer: { ...fine.note, marginTop: 20 },
});
