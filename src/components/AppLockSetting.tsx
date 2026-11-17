import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { t } from '@/i18n';
import { disableAppLock, enableAppLock, setLockAfter, useAppLockPrefs } from '@/data/appLock';
import { LOCK_AFTER_OPTIONS, lockOnFor, unlockProblem, type BiometricKind, type LockAfter } from '@/logic/appLock';
import { authenticate, biometricStatus, type BiometricStatus } from '@/utils/biometrics';
import { FChip, formStyles } from '@/components/fine/FineForm';
import { SetRow, FineSwitch } from '@/components/settings/SettingsParts';
import { fine } from '@/theme/fine';

// Ajustes → Cuenta → «Bloquear Kuova con Face ID / huella» (apagado de serie). Solo con el módulo nativo (APK o
// app de iPhone desde el 2026-11-11). Si el móvil no tiene huella ni cara configuradas, una línea lo explica.
// Al activarlo se pide la cara o el dedo una vez. Cómo bloquea: src/components/AppLock.tsx.
// Desde el 2026-11-17, en el lenguaje fino de Ajustes: fila con línea fina y su interruptor, sin icono, y el «cuándo
// bloquear» en chips con borde. Un fallo, en coral suave (sin rojo).

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

  const title = t(TITLE[status.kind]);
  return (
    <>
      <SetRow
        title={title}
        sub={
          ready
            ? t('Kuova asks for it when you open it and when you come back after a while. It does not replace two-step verification.')
            : status.state === 'not_enrolled'
              ? t('To use it, first set up your fingerprint or face in your phone settings.')
              : t('This phone has no fingerprint reader or face recognition.')
        }
        right={ready ? <FineSwitch value={on} onValueChange={toggle} disabled={busy} accessibilityLabel={title} /> : undefined}
      >
        {error ? <Text style={[formStyles.error, styles.error]}>{error}</Text> : null}
      </SetRow>
      {on && prefs && (
        <View style={[fine.row, styles.after]}>
          <Text style={fine.rowSub}>{t('Lock when you come back')}</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {LOCK_AFTER_OPTIONS.map((ms) => (
              <FChip key={ms} label={t(AFTER_LABEL[ms])} on={prefs.afterMs === ms} onPress={() => setLockAfter(ms)} />
            ))}
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  error: { marginTop: 4 },
  // «Bloquear al volver»: la línea y, debajo, los chips
  after: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
