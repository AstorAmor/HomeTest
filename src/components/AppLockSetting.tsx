import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { t } from '@/i18n';
import { disableAppLock, enableAppLock, setLockAfter, useAppLockPrefs } from '@/data/appLock';
import { LOCK_AFTER_OPTIONS, lockOnFor, unlockProblem, type BiometricKind, type LockAfter } from '@/logic/appLock';
import { authenticate, biometricStatus, type BiometricStatus } from '@/utils/biometrics';

// Ajustes → Cuenta → «Bloquear Kuova con Face ID / huella» (apagado de serie). Solo con el módulo nativo (APK o
// app de iPhone desde el 2026-11-11). Si el móvil no tiene huella ni cara configuradas, una línea lo explica.
// Al activarlo se pide la cara o el dedo una vez. Cómo bloquea: src/components/AppLock.tsx.

const TITLE: Record<BiometricKind, string> = {
  face_id: 'Lock Kuova with Face ID',
  touch_id: 'Lock Kuova with Touch ID',
  fingerprint: 'Lock Kuova with your fingerprint',
  face: 'Lock Kuova with your face',
  fingerprint_or_face: 'Lock Kuova with your fingerprint or face',
};
const AFTER_LABEL: Record<LockAfter, string> = { 0: 'Right away', 60000: 'After 1 min', 300000: 'After 5 min' };

export function AppLockSetting() {
  const { user } = useAuth();
  const { prefs } = useAppLockPrefs();
  const [status, setStatus] = useState<BiometricStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // También al volver a la app: quizá acaba de configurar la huella en los ajustes del móvil
  useEffect(() => {
    biometricStatus().then(setStatus);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && biometricStatus().then(setStatus));
    return () => sub.remove();
  }, []);

  if (!user || !status || status.state === 'missing') return null;
  const ready = status.state === 'ready';
  const on = ready && lockOnFor(prefs, user.id);

  const toggle = async (v: boolean) => {
    setError('');
    if (!v) {
      await disableAppLock();
      return;
    }
    setBusy(true);
    const r = await authenticate(t('Confirm it is you'), t('Cancel'));
    setBusy(false);
    if (r.ok) await enableAppLock(user.id);
    else if (unlockProblem(r.error)) setError(t('Could not check it. Try again.'));
  };

  return (
    <>
      <View style={[styles.row, styles.divider]}>
        <Ionicons name={status.kind === 'face_id' || status.kind === 'face' ? 'scan-outline' : 'finger-print'} size={22} color={Colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{t(TITLE[status.kind])}</Text>
          <Text style={styles.rowSub}>
            {ready
              ? t('Kuova asks for it when you open it and when you come back after a while. It does not replace two-step verification.')
              : status.state === 'not_enrolled'
                ? t('To use it, first set up your fingerprint or face in your phone settings.')
                : t('This phone has no fingerprint reader or face recognition.')}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
        {ready && (
          <Switch value={on} onValueChange={toggle} disabled={busy} trackColor={{ true: Colors.accent, false: Colors.cardBorder }} />
        )}
      </View>
      {on && prefs && (
        <View style={[styles.after, styles.divider]}>
          <Text style={styles.afterTitle}>{t('Lock when you come back')}</Text>
          <View style={styles.chips}>
            {LOCK_AFTER_OPTIONS.map((ms) => {
              const sel = prefs.afterMs === ms;
              return (
                <TouchableOpacity
                  key={ms}
                  style={[styles.chip, sel && styles.chipOn]}
                  onPress={() => setLockAfter(ms)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                >
                  <Text style={[styles.chipText, sel && styles.chipTextOn]}>{t(AFTER_LABEL[ms])}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  divider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  rowTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  rowSub: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  error: { color: Colors.danger, fontSize: 12, lineHeight: 17, marginTop: 4 },
  after: { paddingHorizontal: 16, paddingVertical: 12 },
  afterTitle: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: Colors.cardBorder },
  chipOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: Colors.background },
});
