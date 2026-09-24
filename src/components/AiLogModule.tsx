import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { Colors } from '@/constants/colors';
import { getApiBaseUrl } from '@/utils/apiBaseUrl';
import { fetchWithTimeout } from '@/utils/imageUpload';
import { saveAiLogEntry } from '@/data/aiLogRepository';
import { MoodQuadrant, MOOD_QUADRANTS, MOOD_QUADRANT_INFO, AiLogExtraction } from '@/types/aiLog';

const REQUEST_TIMEOUT_MS = 60000;
const WHEEL_SIZE = 212;
const SLIDER_HEIGHT = 176;

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const AiLogModule = () => {
  const [quadrant, setQuadrant] = useState<MoodQuadrant | null>(null);
  const [intensity, setIntensity] = useState(0);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const updateIntensity = (y: number) => {
    const clamped = Math.max(0, Math.min(SLIDER_HEIGHT, y));
    setIntensity(Math.round(((SLIDER_HEIGHT - clamped) / SLIDER_HEIGHT) * 100));
  };

  const sliderResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => updateIntensity(evt.nativeEvent.locationY),
      onPanResponderMove: (evt: GestureResponderEvent) => updateIntensity(evt.nativeEvent.locationY),
    })
  ).current;

  const toggleRecording = async () => {
    setError('');
    if (recorderState.isRecording) {
      await recorder.stop();
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone permission is required to record audio.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const isValid = !!quadrant;

  const handleLog = async () => {
    if (!isValid || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      if (recorderState.isRecording) {
        await recorder.stop();
      }

      let audioPayload: { base64: string; mimeType: string } | undefined;
      if (recorder.uri) {
        const base64 = await FileSystem.readAsStringAsync(recorder.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        audioPayload = { base64, mimeType: 'audio/aac' };
      }

      const trimmedNote = note.trim();

      const response = await fetchWithTimeout(
        `${getApiBaseUrl()}/api/extract-ai-log`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quadrant,
            intensity,
            text: trimmedNote || undefined,
            audio: audioPayload,
          }),
        },
        REQUEST_TIMEOUT_MS
      );

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Error processing the entry');
        return;
      }

      const extraction = data as AiLogExtraction;
      const now = new Date().toISOString();

      await saveAiLogEntry({
        id: `${Date.now()}`,
        fecha: now,
        createdAt: now,
        quadrant: quadrant as MoodQuadrant,
        intensity,
        note: trimmedNote,
        hasAudio: !!audioPayload,
        transcript: extraction.transcript,
        summary: extraction.summary,
        tags: extraction.tags ?? [],
      });

      setQuadrant(null);
      setIntensity(0);
      setNote('');
      setShowNoteInput(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const activeColor = quadrant ? MOOD_QUADRANT_INFO[quadrant].color : Colors.accent;

  return (
    <View style={styles.card}>
      <View style={styles.diagramRow}>
        <View style={styles.wheelWrap}>
          <View style={styles.wheel}>
            <Text style={[styles.wheelAxisLabel, styles.wheelAxisLabelTop]}>Energy</Text>
            <Text style={[styles.wheelAxisLabel, styles.wheelAxisLabelBottom]}>Mood</Text>
            {MOOD_QUADRANTS.map((option) => {
              const info = MOOD_QUADRANT_INFO[option];
              const selected = quadrant === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.quadrantCell,
                    { backgroundColor: hexToRgba(info.color, selected ? 0.9 : 0.25) },
                  ]}
                  onPress={() => setQuadrant(option)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.quadrantEmoji}>{info.emoji}</Text>
                  <Text
                    style={[
                      styles.quadrantLabel,
                      selected && styles.quadrantLabelActive,
                    ]}
                  >
                    {info.label}
                  </Text>
                  {selected && (
                    <View style={styles.quadrantCheck}>
                      <Ionicons name="checkmark-circle" size={14} color={Colors.textPrimary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.intensityCol}>
          <MaterialCommunityIcons name="run" size={18} color={Colors.textSecondary} />
          <View style={styles.sliderTrack} {...sliderResponder.panHandlers}>
            <View
              style={[
                styles.sliderFill,
                { height: `${intensity}%`, backgroundColor: activeColor },
              ]}
            />
            <View style={[styles.sliderThumb, { bottom: `${intensity}%`, borderColor: activeColor }]} />
          </View>
          <MaterialCommunityIcons name="sleep" size={16} color={Colors.textSecondary} />
        </View>
      </View>

      {showNoteInput && (
        <TextInput
          style={styles.textInput}
          value={note}
          onChangeText={setNote}
          placeholder="Add more detail (optional)…"
          placeholderTextColor={Colors.textMuted}
          multiline
          autoFocus
        />
      )}

      {recorderState.isRecording && (
        <Text style={styles.recordingText}>
          Recording… {Math.round(recorderState.durationMillis / 1000)}s
        </Text>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.logButton, (!isValid || submitting) && styles.logButtonDisabled]}
          onPress={handleLog}
          disabled={!isValid || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.background} size="small" />
          ) : (
            <Text style={styles.logButtonText}>{saved ? 'Logged ✓' : 'Log'}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.iconGroup}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowNoteInput((v) => !v)}
          >
            <Ionicons
              name="pencil-outline"
              size={17}
              color={showNoteInput ? Colors.accent : Colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, recorderState.isRecording && styles.iconButtonActive]}
            onPress={toggleRecording}
          >
            <Ionicons
              name={recorderState.isRecording ? 'stop' : 'mic-outline'}
              size={17}
              color={recorderState.isRecording ? Colors.background : Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 28,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 10,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonActive: {
    backgroundColor: Colors.danger,
  },
  diagramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wheelWrap: {
    marginLeft: 10,
    marginTop: 2,
  },
  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
    position: 'relative',
  },
  wheelAxisLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.55)',
    zIndex: 1,
  },
  wheelAxisLabelTop: {
    top: 6,
  },
  wheelAxisLabelBottom: {
    bottom: 6,
  },
  quadrantCell: {
    width: WHEEL_SIZE / 2,
    height: WHEEL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quadrantEmoji: {
    fontSize: 18,
  },
  quadrantLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  quadrantLabelActive: {
    color: Colors.textPrimary,
  },
  quadrantCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  intensityCol: {
    alignItems: 'center',
    gap: 6,
    marginLeft: -33,
    marginTop: 5,
  },
  sliderTrack: {
    width: 24,
    height: SLIDER_HEIGHT,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  sliderFill: {
    width: '100%',
    borderRadius: 12,
  },
  sliderThumb: {
    position: 'absolute',
    left: -3,
    width: 30,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.textPrimary,
    borderWidth: 2,
    marginBottom: -6,
  },
  textInput: {
    color: Colors.textPrimary,
    fontSize: 14,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    maxHeight: 100,
    marginTop: 14,
  },
  recordingText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  iconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 10,
    minWidth: 190,
    alignItems: 'center',
  },
  logButtonDisabled: {
    backgroundColor: Colors.cardBorder,
  },
  logButtonText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
});
