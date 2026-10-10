import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OnDark } from '@/constants/colors';

import { t } from '@/i18n';
// Zona de vídeo/llamada. PROTOTIPO: todavía sin proveedor de vídeo; muestra la sala,
// los controles y el tiempo. Al integrar el proveedor (Daily, Whereby, LiveKit…), su
// componente de vídeo sustituye al contenido de `stage` sin tocar el resto de la sala.

interface Props {
  patientName: string;
  mode: 'video' | 'voice';
  onEnd: () => void;
  compactControls?: boolean;
  bottomInset?: number; // espacio para los botones de la sala en móvil
}

export const VideoPane = ({ patientName, mode, onEnd, bottomInset = 0 }: Props) => {
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(mode === 'video');
  const [seconds, setSeconds] = useState(0);
  const [connected, setConnected] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => setConnected(true), 2500); // simulación: el paciente entra
    const i = setInterval(() => setSeconds((s) => s + 1), 1000);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      clearTimeout(t);
      clearInterval(i);
      loop.stop();
    };
  }, [pulse]);

  const initials = patientName.split(' ').map((p) => p[0]).slice(0, 2).join('');
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <View style={styles.stage}>
      <View style={styles.topBar}>
        <View style={[styles.live, { backgroundColor: connected ? '#2BB673' : '#8A8F9C' }]} />
        <Text style={styles.topText}>
          {connected ? `${patientName} · ${mm}:${ss}` : t('Waiting for {name}…', { name: patientName })}
        </Text>
      </View>

      <View style={styles.center}>
        <Animated.View style={[styles.avatarRing, { transform: [{ scale: connected ? 1 : scale }] }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </Animated.View>
        <Text style={styles.note}>
          {mode === 'video' ? t('Video') : t('Voice call')} · {t('prototype, the video provider is not connected yet')}
        </Text>
      </View>

      {mode === 'video' && (
        <View style={[styles.self, { bottom: 90 + bottomInset }]}>
          {cam ? <Ionicons name="person" size={30} color={OnDark.textSecondary} /> : <Ionicons name="videocam-off" size={22} color={OnDark.textSecondary} />}
          <Text style={styles.selfText}>{t('You')}</Text>
        </View>
      )}

      <View style={[styles.controls, { bottom: 20 + bottomInset }]}>
        <Control icon={mic ? 'mic' : 'mic-off'} onPress={() => setMic((v) => !v)} off={!mic} />
        {mode === 'video' && <Control icon={cam ? 'videocam' : 'videocam-off'} onPress={() => setCam((v) => !v)} off={!cam} />}
        <TouchableOpacity style={styles.end} onPress={onEnd} accessibilityLabel={t('End consultation')}>
          <Ionicons name="call" size={24} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const Control = ({ icon, onPress, off }: { icon: string; onPress: () => void; off?: boolean }) => (
  <TouchableOpacity style={[styles.control, off && { backgroundColor: 'rgba(255,255,255,0.9)' }]} onPress={onPress}>
    <Ionicons name={icon as any} size={22} color={off ? '#111' : '#FFFFFF'} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: OnDark.background, overflow: 'hidden' },
  topBar: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 2 },
  live: { width: 10, height: 10, borderRadius: 5 },
  topText: { color: OnDark.text, fontSize: 14, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 20 },
  avatarRing: { width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: OnDark.text, fontSize: 40, fontWeight: '800' },
  note: { color: OnDark.textSecondary, fontSize: 12, textAlign: 'center' },
  self: { position: 'absolute', right: 14, width: 96, height: 128, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  selfText: { color: OnDark.textSecondary, fontSize: 11 },
  controls: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 16 },
  control: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  end: { width: 64, height: 54, borderRadius: 27, backgroundColor: '#E5484D', alignItems: 'center', justifyContent: 'center' },
});
