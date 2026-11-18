import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { BRAND, GoldK, LAUNCH_BG, brandFrameHeight } from '@/components/LaunchIntro';
import { KuovaWordmark } from '@/components/KuovaLogo';
import { t } from '@/i18n';
import { hideInRecents, useAppLockPrefs } from '@/data/appLock';
import { isExpectedLeave, lockOnFor, shouldLockOnReturn, unlockProblem, type BiometricKind, type UnlockProblem } from '@/logic/appLock';
import { authenticate, authenticating, biometricStatus, biometricsInstalled } from '@/utils/biometrics';
import { clearSystemUi, systemUiExpectedAt } from '@/utils/systemUi';
import { INTER } from '@/theme/fine';

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
// - Las hojas del sistema que abre la propia app (compartir, fotos, archivos, cámara, permisos…) no ponen la capa:
//   avisan antes con expectSystemUi (src/utils/systemUi.ts; fundador, 2026-11-17: «al compartir el informe ha
//   aparecido la K de KUOVA en medio de la pantalla»).

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
  // Esta salida es una hoja del sistema que ha abierto la app (compartir, una foto…): ni capa ni bloqueo al volver
  // si es enseguida (src/logic/appLock.ts)
  const leaveExpected = useRef(false);
  // Cuándo ha empezado esta salida (el primer 'inactive' o 'background')
  const leaveAt = useRef<number | null>(null);
  const afterMs = prefs?.afterMs ?? 60_000;
  const reduceMotion = useReducedMotion();

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
        const now = Date.now();
        if (leaveAt.current === null) leaveAt.current = now;
        if (isExpectedLeave(systemUiExpectedAt(), now)) leaveExpected.current = true;
        if (s === 'background' && backgroundAt.current === null) backgroundAt.current = now;
        // La hoja que ha abierto la app se ve encima de la app: sin la capa. En iPhone, 'background' es que de
        // verdad ya no se ve (los ajustes del móvil, Safari): ahí sí, para la miniatura del selector de apps.
        const sheetOverApp = leaveExpected.current && (Platform.OS !== 'ios' || s === 'inactive');
        if (phaseRef.current === 'open' && !sheetOverApp) setPhase('covered');
        return;
      }
      if (s !== 'active') return;
      const lock = shouldLockOnReturn(afterMs, backgroundAt.current, Date.now(), leaveExpected.current);
      // El aviso que ha servido para esta salida, fuera. Uno puesto después de salir se queda: tras el permiso de la
      // cámara, el aviso de abrirla puede llegar antes que este 'active'
      const expectedAt = systemUiExpectedAt();
      if (expectedAt !== null && leaveAt.current !== null && expectedAt <= leaveAt.current) clearSystemUi();
      backgroundAt.current = null;
      leaveAt.current = null;
      leaveExpected.current = false;
      // Ya bloqueada: se vuelve a pedir (la petición anterior se cancela al salir de la app)
      if (phaseRef.current === 'locked' || lock) lockNow();
      else setPhase('open');
    });
    return () => sub.remove();
  }, [on, afterMs, lockNow, setPhase]);

  // Al abrir en frío, antes de decidir: si este móvil tiene el bloqueo puesto, la capa ya desde el principio
  const coldCover = !coldChecked.current && installed && loaded && !!prefs && (initializing || on);
  const visible = coldCover || (on && phase !== 'open');

  // Al abrir en frío esta capa tapa la entrada (LaunchIntro) desde su primer fotograma: hace lo mismo que ella, la K
  // quieta y el nombre apareciendo debajo (antes salía de golpe). Las demás veces, todo a la vez.
  const reveal = useRef<Animated.Value | null>(null);
  const revealPending = useRef(false);
  if (visible && !reveal.current) {
    revealPending.current = coldCover && !reduceMotion;
    reveal.current = new Animated.Value(revealPending.current ? 0 : 1);
  }
  useEffect(() => {
    if (!visible || !revealPending.current || !reveal.current) return;
    revealPending.current = false;
    Animated.timing(reveal.current, {
      toValue: 1,
      delay: REVEAL_DELAY,
      duration: 560,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible || !reveal.current) return null;
  const locked = on && phase === 'locked';
  const below = {
    opacity: reveal.current.interpolate({ inputRange: [0.25, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: reveal.current.interpolate({ inputRange: [0.25, 1], outputRange: [8, 0], extrapolate: 'clamp' }) }],
  };

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
      {/* La K en el centro exacto y del mismo tamaño que en el splash y la entrada (LaunchIntro): mitad de arriba
          y mitad de abajo iguales, y lo demás cuelga debajo sin moverla al aparecer (fundador, 2026-11-16: «da
          saltos, no va fluido»; antes era de 72 y subía al salir el botón).
          2026-11-17 (fundador: «al abrir la app hay como un salto en la K»): en Android el Modal pinta su primer
          fotograma con el alto de la pantalla menos las barras del sistema (React Native lo calcula así antes de
          saber el de verdad) y al fotograma siguiente con el alto entero: la K, centrada en ese alto, bajaba de golpe
          media barra de estado y media de navegación. Ahora la capa tiene el alto de la pantalla de la app desde el
          principio (brandFrameHeight, el mismo en el que se centra la K de la entrada) y no depende del Modal. */}
      <View style={styles.fill}>
        <View style={[styles.screen, { height: brandFrameHeight() }]} accessibilityViewIsModal>
          <View style={styles.half} />
          <GoldK />
          <Animated.View style={[styles.half, below]}>
            <View style={styles.word}>
              <KuovaWordmark height={BRAND.WORD_H} color="#F4EFE3" />
              <Text style={styles.health} allowFontScaling={false}>
                HEALTH
              </Text>
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
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const CREAM = '#F4EFE3';
const GOLD = '#C9A366';
// Como la entrada (LaunchIntro, START): el nombre empieza a salir cuando la pantalla nativa ya se ha ido
const REVEAL_DELAY = 200;

const styles = StyleSheet.create({
  // Lo que ocupe el Modal (en su primer fotograma, menos que la pantalla), del mismo verde
  fill: { flex: 1, backgroundColor: LAUNCH_BG },
  // La capa, con el alto de la pantalla de la app puesto (no el del Modal): la K no se mueve
  screen: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: LAUNCH_BG, alignItems: 'center', paddingHorizontal: 32 },
  half: { flex: 1, alignSelf: 'stretch', alignItems: 'center' },
  word: { alignItems: 'center', marginTop: BRAND.GAP_K },
  // Como «HEALTH» en la entrada
  health: { color: GOLD, fontSize: 11, lineHeight: BRAND.HEALTH_H, fontFamily: INTER.medium, letterSpacing: 7, marginRight: -7, marginTop: BRAND.GAP_WORD },
  box: { alignItems: 'center', alignSelf: 'stretch', marginTop: 48 },
  title: { color: CREAM, fontSize: 18, fontFamily: INTER.medium, marginBottom: 14 },
  problem: { color: CREAM, opacity: 0.85, fontFamily: INTER.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 14 },
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
  buttonText: { color: LAUNCH_BG, fontSize: 16, fontFamily: INTER.medium },
  link: { marginTop: 20, paddingVertical: 6 },
  linkText: { color: GOLD, fontSize: 15, fontFamily: INTER.medium },
  note: { color: CREAM, opacity: 0.6, fontFamily: INTER.regular, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 6 },
});
