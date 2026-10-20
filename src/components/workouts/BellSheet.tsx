import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/colors';
import { WorkoutModal } from '@/components/workouts/WorkoutModal';
import {
  allowBellOnLock,
  BELL_TONES,
  BellLockStatus,
  BellPrefs,
  bellLockStatus,
  lockToneAvailable,
  openPhoneSettings,
  ringBell,
} from '@/data/workouts/bell';
import { t } from '@/i18n';

// Hoja «Sonido» del entrenamiento: quitar el timbre, elegir tono (suena al tocarlo) y qué pasa con
// la pantalla bloqueada en este móvil (permiso de avisos, APK con los tonos).
export const BellSheet = ({
  visible,
  prefs,
  onChange,
  onClose,
}: {
  visible: boolean;
  prefs: BellPrefs;
  onChange: (change: Partial<BellPrefs>) => void;
  onClose: () => void;
}) => {
  const [lock, setLock] = useState<BellLockStatus | null>(null);
  useEffect(() => {
    if (visible) bellLockStatus().then(setLock).catch(() => setLock(null));
  }, [visible]);

  return (
    <WorkoutModal visible={visible} title={t('Sound')} onClose={onClose}>
      <View style={styles.switchRow}>
        <Text style={styles.switchText}>{t('Sound when the countdown ends')}</Text>
        <Switch
          value={prefs.on}
          onValueChange={(on) => {
            onChange({ on });
            if (on) ringBell(prefs.tone);
          }}
          trackColor={{ false: Colors.cardBorder, true: withAlpha(Colors.accent, 0.6) }}
          thumbColor={prefs.on ? Colors.accent : Colors.textMuted}
        />
      </View>
      <Text style={styles.hint}>{t('Tap a sound to hear it.')}</Text>
      {BELL_TONES.map((x) => {
        const sel = prefs.on && x.id === prefs.tone;
        return (
          <TouchableOpacity
            key={x.id}
            style={[styles.tone, sel && styles.toneOn]}
            onPress={() => {
              onChange({ tone: x.id, on: true });
              ringBell(x.id);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: sel }}
          >
            <Ionicons name={sel ? 'radio-button-on' : 'radio-button-off'} size={20} color={sel ? Colors.accent : Colors.textMuted} />
            <Text style={[styles.toneText, sel && styles.toneTextOn]}>{t(x.label)}</Text>
            <MaterialCommunityIcons name="volume-high" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        );
      })}
      {prefs.on && lock && <LockNote status={lock} tone={prefs.tone} onStatus={setLock} />}
    </WorkoutModal>
  );
};

const LockNote = ({ status, tone, onStatus }: { status: BellLockStatus; tone: BellPrefs['tone']; onStatus: (s: BellLockStatus) => void }) => {
  const text: Record<BellLockStatus, string> = {
    web: 'In the browser it only rings with this page open.',
    'old-app': 'With the screen locked it will ring once you install the latest version of the app.',
    ask: 'To ring with the screen locked too, Kuova needs permission to send you notifications.',
    blocked: 'Notifications from Kuova are off in your phone settings, so it will not ring with the screen locked.',
    on: lockToneAvailable()
      ? 'It also rings with the screen locked.'
      : "With the screen locked you will hear your phone's notification sound. The sound you choose here comes with the next version of the app.",
  };
  return (
    <View style={styles.note}>
      <View style={styles.noteHead}>
        <Ionicons name="lock-closed-outline" size={15} color={Colors.textSecondary} />
        <Text style={styles.noteText}>{t(text[status])}</Text>
      </View>
      {status === 'ask' && (
        <TouchableOpacity style={styles.noteButton} onPress={() => allowBellOnLock(tone).then(onStatus)}>
          <Text style={styles.noteButtonText}>{t('Allow notifications')}</Text>
        </TouchableOpacity>
      )}
      {status === 'blocked' && (
        <TouchableOpacity style={styles.noteButton} onPress={openPhoneSettings}>
          <Text style={styles.noteButtonText}>{t('Open settings')}</Text>
        </TouchableOpacity>
      )}
      {/* En Android 14+ las alarmas exactas hay que permitirlas a mano; sin ellas el aviso puede llegar tarde */}
      {status === 'on' && Platform.OS === 'android' && lockToneAvailable() && (
        <Text style={styles.noteSmall}>
          {t('If it rings late with the screen locked, allow "Alarms & reminders" for Kuova in your phone settings.')}{' '}
          <Text style={styles.noteLink} onPress={openPhoneSettings}>
            {t('Open settings')}
          </Text>
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  switchText: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  hint: { color: Colors.textSecondary, fontSize: 13, marginBottom: 10 },
  tone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  toneOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  toneText: { flex: 1, color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  toneTextOn: { color: Colors.textPrimary, fontWeight: '800' },
  note: { marginTop: 8, gap: 10 },
  noteHead: { flexDirection: 'row', gap: 8 },
  noteText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  noteButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.accent, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  noteButtonText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  noteSmall: { color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
  noteLink: { color: Colors.accent, fontWeight: '700' },
});
