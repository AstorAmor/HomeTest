import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { GoldK, LAUNCH_BG } from '@/components/LaunchIntro';
import { KuovaWordmark } from '@/components/KuovaLogo';
import { t } from '@/i18n';
import { hideInRecents, useAppLockPrefs } from '@/data/appLock';
import { lockOnFor, shouldLockOnReturn, unlockProblem, type BiometricKind, type UnlockProblem } from '@/logic/appLock';
import { authenticate, authenticating, biometricStatus, biometricsInstalled } from '@/utils/biometrics';

// Bloqueo de Kuova con Face ID / huella (Ajustes → «Bloquear Kuova…», apagado de serie). Reglas en
// src/logic/appLock.ts. Por encima de todo (un Modal: en Android es otra ventana, así tapa también las pantallas
// que se abren encima de las pestañas):
// - Al abrir la app en frío con la sesión guardada: bloqueada. Tras entrar con la contraseña, no (ya lo has hecho).
// - Al pasar a segundo plano: una capa con la marca, para que la miniatura de «apps recientes» no enseñe nada
//   de salud (en Android 13+ además la miniatura sale en blanco, modules/kuova-privacy). Al volver: si ha pasado
//   el rato elegido (al momento, 1 o 5 min), bloqueada; si no, se quita la capa.
// - Desbloquear: la cara o el dedo; si fallan, el código, PIN o patrón del móvil. «Usar contraseña» cierra la
//   sesión y lleva al login de siempre (con el doble factor, si lo tiene). No sustituye al doble factor.
// Sin el módulo nativo (APK o app de iPhone anteriores al 2026-11-11) no hace nada.

type Phase = 'open' | 'covered' | 'locked';

const ICON: Record<BiometricKind, keyof typeof Ionicons.glyphMap> = {
  face_id: 'scan-outline',
  face: 'scan-outline',
  touch_id: 'finger-print',
  fingerprint: 'finger-print',
  fingerprint_or_face: 'lock-open-outline',
};
const UNLOCK_LABEL: Record<BiometricKind, string> = {
  face_id: 'Unlock with Face ID',
  touch_id: 'Unlock with Touch ID',
  fingerprint: 'Unlock with your fingerprint',
  face: 'Unlock with your face',
  fingerprint_or_face: 'Unlock',
};
const PROBLEM: Record<Exclude<UnlockProblem, null>, string> = {
  lockout: 'Too many attempts. Use your phone code, wait a moment, or use your password.',
  not_set_up: 'This phone no longer has a fingerprint, face or screen lock set up. Use your password.',
  failed: 'Could not check it. Try again or use your password.',
};

export function AppLock() {
  const { isLoggedIn, initializing, user, logout } = useAuth();
  const { loaded, prefs } = useAppLockPrefs();
  const installed = biometricsInstalled();
  const on = installed && isLoggedIn && lockOnFor(prefs, user?.id);

  const [phase, setPhaseState] = useState<Phase>('open');
  // La fase también en una ref: los avisos de AppState la leen sin esperar a que React pinte
  const phaseRef = useRef<Phase>('open');
  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  const [problem, setProblem] = useState<UnlockProblem>(null);
  const [kind, setKind] = useState<BiometricKind>(Platform.OS === 'ios' ? 'face_id' : 'fingerprint_or_face');
  const coldChecked = useRef(false);
  const backgroundAt = useRef<number | null>(null);
  const afterMs = prefs?.afterMs ?? 60_000;

  const unlock = useCallback(async () => {
    if (authenticating()) return;
    setProblem(null);
    const r = await authenticate(t('Unlock Kuova'), t('Cancel'));
    if (r.ok) {
      backgroundAt.current = null;
      setPhase('open');
    } else setProblem(unlockProblem(r.error));
  }, [setPhase]);

  // Bloquear y, con la app delante, pedir la cara o el dedo sin tener que tocar nada
  const lockNow = useCallback(() => {
    // iPhone: un Modal no se puede presentar encima de otra pantalla que ya sea modal (registro, check-in…):
    // se cierran antes. En Android no hace falta (todo va en la misma ventana, debajo de la del bloqueo).
    if (Platform.OS === 'ios' && router.canDismiss()) router.dismissAll();
    setPhase('locked');
    setProblem(null);
    setTimeout(() => {
      if (AppState.currentState === 'active') unlock();
    }, 350);
  }, [unlock, setPhase]);

  // Al abrir en frío: en cuanto se sabe si hay sesión guardada (y de quién) y está leída la preferencia
  useEffect(() => {
    if (coldChecked.current || initializing || !loaded) return;
    coldChecked.current = true;
    if (on) lockNow();
  }, [initializing, loaded, on, lockNow]);

  // Sin bloqueo (apagado, sin sesión, otra cuenta): nada encima
  useEffect(() => {
    hideInRecents(on);
    if (!on) {
      backgroundAt.current = null;
      setPhase('open');
      setProblem(null);
    } else {
      biometricStatus().then((s) => setKind(s.kind));
    }
  }, [on, setPhase]);

  useEffect(() => {
    if (!on) return;
    const sub = AppState.addEventListener('change', (s) => {
      // La huella, la cara o el PIN del móvil también sacan a la app de primer plano un momento
      if (authenticating()) return;
      if (s === 'background' || s === 'inactive') {
        if (s === 'background' && backgroundAt.current === null) backgroundAt.current = Date.now();
        if (phaseRef.current === 'open') setPhase('covered');
        return;
      }
      if (s !== 'active') return;
      const lock = shouldLockOnReturn(afterMs, backgroundAt.current, Date.now());
      backgroundAt.current = null;
      // Ya bloqueada: se vuelve a pedir (la petición anterior se cancela al salir de la app)
      if (phaseRef.current === 'locked' || lock) lockNow();
      else setPhase('open');
    });
    return () => sub.remove();
  }, [on, afterMs, lockNow, setPhase]);

  // Al abrir en frío, antes de decidir: si este móvil tiene el bloqueo puesto, la capa ya desde el principio
  const coldCover = !coldChecked.current && installed && loaded && !!prefs && (initializing || on);
  const visible = coldCover || (on && phase !== 'open');
  if (!visible) return null;
  const locked = on && phase === 'locked';

  const signInWithPassword = () => {
    logout();
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
  };

  return (
    <Modal
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['portrait']}
      // Atrás (Android): sigue bloqueada
      onRequestClose={() => undefined}
    >
      <View style={styles.screen} accessibilityViewIsModal>
        <GoldK width={72} />
        <View style={styles.word}>
          <KuovaWordmark height={20} color="#F4EFE3" />
          <Text style={styles.health}>HEALTH</Text>
        </View>
        {locked && (
          <View style={styles.box}>
            <Text style={styles.title}>{t('Kuova is locked')}</Text>
            {problem ? <Text style={styles.problem}>{t(PROBLEM[problem])}</Text> : null}
            <TouchableOpacity style={styles.button} onPress={unlock} activeOpacity={0.85} accessibilityRole="button">
              <Ionicons name={ICON[kind]} size={20} color={LAUNCH_BG} />
              <Text style={styles.buttonText}>{t(UNLOCK_LABEL[kind])}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.link} onPress={signInWithPassword} hitSlop={8} accessibilityRole="button">
              <Text style={styles.linkText}>{t('Use your password')}</Text>
            </TouchableOpacity>
            <Text style={styles.note}>
              {t('You sign out on this phone and sign in again with your password (and your code, if you use two-step verification).')}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const CREAM = '#F4EFE3';
const GOLD = '#C9A366';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: LAUNCH_BG, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  word: { alignItems: 'center', marginTop: 30 },
  health: { color: GOLD, fontSize: 11, fontWeight: '600', letterSpacing: 7, paddingLeft: 7, marginTop: 12 },
  box: { alignItems: 'center', alignSelf: 'stretch', marginTop: 48 },
  title: { color: CREAM, fontSize: 18, fontWeight: '700', marginBottom: 14 },
  problem: { color: CREAM, opacity: 0.85, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 14 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    alignSelf: 'stretch',
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 14,
  },
  buttonText: { color: LAUNCH_BG, fontSize: 16, fontWeight: '700' },
  link: { marginTop: 20, paddingVertical: 6 },
  linkText: { color: GOLD, fontSize: 15, fontWeight: '700' },
  note: { color: CREAM, opacity: 0.6, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 6 },
});
