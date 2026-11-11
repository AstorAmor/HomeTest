import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/colors';
import { t } from '@/i18n';
import { findPendingTotp, startTotpEnrollment, verifyTotp, type TotpEnrollment } from '@/data/mfa';
import { cleanTotpCode, groupSecret, isTotpCodeComplete, minutesAgo } from '@/logic/mfa';
import { qrShape } from '@/logic/qr';

export const totpErrorMessage = (m: string) =>
  /invalid totp|invalid code|code.*(invalid|incorrect)|mfa_verification_failed/i.test(m)
    ? t('That code is not right. Use the newest code and check that your phone sets the time automatically. If Kuova appears more than once in your app, use the one you added last.')
    : /expired|challenge/i.test(m)
      ? t('That code has expired. Type the one the app shows now.')
      : m;

// Alta de una app de autenticación (TOTP): QR, «Abrir en mi app de autenticación» (si la app está en el
// mismo móvil no se puede escanear la propia pantalla), la clave para escribirla a mano y el primer código.
// Al verificarlo, la sesión pasa a aal2 y se llama a onDone.
// Si la app se cerró a medias (pasa en Android al ir a la app de autenticación), al volver se retoma el alta
// en vez de crear otra clave (la ya guardada dejaría de valer): basta con escribir su código.
export const TotpSetup = ({ onDone }: { onDone: () => void }) => {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [pending, setPending] = useState<{ id: string; createdAt: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Solo cuenta el último intento: cada alta nueva borra la anterior sin verificar (y en desarrollo el
  // efecto corre dos veces)
  const attempt = useRef(0);
  const start = () => {
    const mine = ++attempt.current;
    setError('');
    setCode('');
    setPending(null);
    setEnrollment(null);
    startTotpEnrollment()
      .then((e) => mine === attempt.current && setEnrollment(e))
      .catch(() => mine === attempt.current && setError(t('Could not start the setup. Try again in a moment.')));
  };
  useEffect(() => {
    const mine = ++attempt.current;
    findPendingTotp()
      .catch(() => null)
      .then((p) => {
        if (mine !== attempt.current) return;
        if (p) setPending(p);
        else start();
      });
  }, []);

  const factorId = enrollment?.factorId ?? pending?.id;
  const activate = async () => {
    if (!factorId) return;
    setBusy(true);
    setError('');
    try {
      await verifyTotp(factorId, code);
      onDone();
    } catch (e) {
      setError(totpErrorMessage(e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  };

  const codeStep = (
    <>
      <TextInput
        style={styles.codeInput}
        value={code}
        onChangeText={(v) => setCode(cleanTotpCode(v))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        placeholder="123456"
        placeholderTextColor={Colors.textMuted}
        maxLength={7}
        editable={!busy}
        onSubmitEditing={() => isTotpCodeComplete(code) && activate()}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.button, (!isTotpCodeComplete(code) || busy) && styles.buttonDisabled]}
        onPress={activate}
        disabled={!isTotpCodeComplete(code) || busy}
      >
        {busy ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.buttonText}>{t('Activate')}</Text>}
      </TouchableOpacity>
    </>
  );

  if (pending && !enrollment) {
    return (
      <View>
        <Text style={styles.step}>{t('You had already started')}</Text>
        <Text style={styles.text}>
          {t('You started adding Kuova {min} min ago. If it is already in your authenticator app, type the code it shows:', {
            min: String(minutesAgo(pending.createdAt, Date.now())),
          })}
        </Text>
        <View style={{ marginTop: 12 }}>{codeStep}</View>
        <TouchableOpacity style={[styles.secondary, { marginTop: 18 }]} onPress={start} disabled={busy}>
          <Ionicons name="refresh-outline" size={16} color={Colors.accent} />
          <Text style={styles.secondaryText}>{t('Start again')}</Text>
        </TouchableOpacity>
        <Text style={styles.tip}>
          {t('If you start again, delete the old Kuova entry from your authenticator app: its codes will no longer work.')}
        </Text>
      </View>
    );
  }

  if (!enrollment) {
    return (
      <View style={styles.loading}>
        {error ? (
          <>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity style={styles.secondary} onPress={start}>
              <Text style={styles.secondaryText}>{t('Try again')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator color={Colors.accent} />
        )}
      </View>
    );
  }

  // QR propio a partir del uri (como la tarjeta de emergencia), con 4 módulos de margen blanco. El SVG que
  // da Supabase no trae viewBox: a 190 px salía cortado y sin una de las esquinas (no se podía escanear).
  const qr = qrShape(enrollment.uri);
  return (
    <View>
      <Text style={styles.step}>{t('1. Add Kuova to your authenticator app')}</Text>
      <Text style={styles.text}>{t('Scan this code with the app.')}</Text>
      <View style={styles.qrBox} accessible accessibilityLabel={t('QR code for your authenticator app')}>
        <Svg width={QR_PX} height={QR_PX} viewBox={`-4 -4 ${qr.size + 8} ${qr.size + 8}`}>
          <Path d={qr.path} fill="#000000" />
        </Svg>
      </View>
      {Platform.OS !== 'web' && (
        <>
          <Text style={styles.text}>{t('Is the app on this phone? Open it directly:')}</Text>
          <TouchableOpacity style={styles.secondary} onPress={() => Linking.openURL(enrollment.uri).catch(() => undefined)}>
            <Ionicons name="open-outline" size={16} color={Colors.accent} />
            <Text style={styles.secondaryText}>{t('Open in my authenticator app')}</Text>
          </TouchableOpacity>
        </>
      )}
      <Text style={styles.text}>{t('Or type this key in the app:')}</Text>
      <Text style={styles.secret} selectable>
        {groupSecret(enrollment.secret)}
      </Text>

      <Text style={[styles.step, { marginTop: 22 }]}>{t('2. Type the 6-digit code the app shows')}</Text>
      {codeStep}
      <Text style={styles.tip}>
        {t('Tip: add Kuova to two apps (for example this phone and 1Password). If you lose your phone, the other one still works.')}
      </Text>
    </View>
  );
};

const QR_PX = 200;

export const totpStyles = StyleSheet.create({
  codeInput: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    color: Colors.textPrimary,
    backgroundColor: withAlpha(Colors.card, 0.72),
    fontVariant: ['tabular-nums'],
  },
  button: { backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { backgroundColor: Colors.cardBorder },
  buttonText: { color: Colors.background, fontSize: 16, fontWeight: '700' },
  error: { color: Colors.danger, fontSize: 14, marginTop: 10, lineHeight: 20 },
});

const styles = StyleSheet.create({
  ...totpStyles,
  loading: { paddingVertical: 30, alignItems: 'center', gap: 12 },
  step: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  text: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 8 },
  qrBox: { alignSelf: 'center', backgroundColor: '#FFFFFF', padding: 4, borderRadius: 12, marginVertical: 12 },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: withAlpha(Colors.accent, 0.35),
  },
  secondaryText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  secret: {
    marginTop: 6,
    color: Colors.textPrimary,
    fontSize: 16,
    letterSpacing: 1,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  tip: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 16 },
});
