import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import { Colors, withAlpha } from '@/constants/colors';
import { audioUrl } from '@/data/consultations';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const MAX_SECONDS = 180;

// Grabar una nota de voz (máx. 3 min). Devuelve la uri local del audio (o null al borrarlo).
export const VoiceRecorder = ({ onChange }: { onChange: (uri: string | null) => void }) => {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<'idle' | 'recording' | 'done'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const start = async () => {
    setError('');
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setError('Allow microphone access to record a voice note.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setSeconds(0);
    setState('recording');
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stop();
        return s + 1;
      });
    }, 1000);
  };

  const stop = async () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    setUri(recorder.uri);
    onChange(recorder.uri);
    setState('done');
  };

  const discard = () => {
    setUri(null);
    onChange(null);
    setState('idle');
    setSeconds(0);
  };

  if (state === 'done' && uri) {
    return (
      <View style={styles.row}>
        <AudioPlayerButton uri={uri} label={`Voice note · ${mmss(seconds)}`} />
        <TouchableOpacity onPress={discard} hitSlop={8} accessibilityLabel="Delete voice note">
          <Ionicons name="trash-outline" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <TouchableOpacity
        style={[styles.recordBtn, state === 'recording' && styles.recording]}
        onPress={state === 'recording' ? stop : start}
        accessibilityLabel={state === 'recording' ? 'Stop recording' : 'Record a voice note'}
      >
        <Ionicons name={state === 'recording' ? 'stop' : 'mic'} size={20} color={state === 'recording' ? '#FFFFFF' : Colors.accent} />
        <Text style={[styles.recordText, state === 'recording' && { color: '#FFFFFF' }]}>
          {state === 'recording' ? `Recording… ${mmss(seconds)} · tap to stop` : 'Record a voice note instead'}
        </Text>
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {Platform.OS === 'web' && state === 'idle' ? <Text style={styles.hint}>Your browser will ask for the microphone.</Text> : null}
    </View>
  );
};

// Botón para escuchar un audio (local o URL firmada).
export const AudioPlayerButton = ({ uri, label = 'Voice note' }: { uri: string; label?: string }) => {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;
  const toggle = () => {
    if (playing) player.pause();
    else {
      if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.2)) player.seekTo(0);
      player.play();
    }
  };
  return (
    <TouchableOpacity style={styles.player} onPress={toggle}>
      <Ionicons name={playing ? 'pause' : 'play'} size={18} color={Colors.background} />
      <Text style={styles.playerText}>
        {label}
        {status.duration > 0 ? ` · ${mmss(playing ? status.currentTime : status.duration)}` : ''}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: withAlpha(Colors.accent, 0.5),
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  recording: { backgroundColor: '#E5484D', borderColor: '#E5484D' },
  recordText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  error: { color: Colors.danger, fontSize: 12, marginTop: 6 },
  hint: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, alignSelf: 'flex-start' },
  playerText: { color: Colors.background, fontSize: 13, fontWeight: '700' },
});

// Nota de voz guardada (Storage o local): pide la URL firmada y la reproduce.
export const StoredAudio = ({ path, label }: { path: string; label?: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    audioUrl(path).then(setUrl).catch(() => setUrl(null));
  }, [path]);
  return url ? <AudioPlayerButton uri={url} label={label} /> : null;
};
