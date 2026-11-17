import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkoutModal } from '@/components/workouts/WorkoutModal';
import { FOption } from '@/components/fine/FineForm';
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
import { FINE, ff, fine } from '@/theme/fine';

// Hoja «Sonido» del entrenamiento: quitar el timbre, elegir tono (suena al tocarlo) y qué pasa con
// la pantalla bloqueada en este móvil (permiso de avisos, APK con los tonos).
// Con el lenguaje fino (2026-11-16): los tonos en filas con línea fina y el círculo de elegido a la derecha.
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
          trackColor={{ false: 'rgba(240,239,230,0.14)', true: FINE.emerald }}
          thumbColor={prefs.on ? FINE.ivory : FINE.mute}
          accessibilityLabel={t('Sound when the countdown ends')}
        />
      </View>
      <Text style={styles.hint}>
        {t('Tap a sound to hear it.')} {t('During the session the screen stays on, so the bell can ring.')}
      </Text>
      {BELL_TONES.map((x, i) => {
        const sel = prefs.on && x.id === prefs.tone;
        return (
          <FOption
            key={x.id}
            title={t(x.label)}
            on={sel}
            last={i === BELL_TONES.length - 1}
            left={<Ionicons name="volume-high-outline" size={17} color={sel ? FINE.jade : FINE.mute} />}
            onPress={() => {
              onChange({ tone: x.id, on: true });
              ringBell(x.id);
            }}
          />
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
        <Ionicons name="lock-closed-outline" size={15} color={FINE.mute} />
        <Text style={styles.noteText}>{t(text[status])}</Text>
      </View>
      {status === 'ask' && (
        <TouchableOpacity style={styles.noteButton} onPress={() => allowBellOnLock(tone).then(onStatus)} accessibilityRole="button">
          <Text style={styles.noteButtonText}>{t('Allow notifications')}</Text>
        </TouchableOpacity>
      )}
      {status === 'blocked' && (
        <TouchableOpacity style={styles.noteButton} onPress={openPhoneSettings} accessibilityRole="button">
          <Text style={styles.noteButtonText}>{t('Open settings')}</Text>
        </TouchableOpacity>
      )}
      {/* En Android 14+ las alarmas exactas hay que permitirlas a mano; sin ellas el aviso puede llegar tarde */}
      {status === 'on' && Platform.OS === 'android' && lockToneAvailable() && (
        <Text style={styles.noteSmall}>
          {t('If it rings late with the screen locked, allow "Alarms & reminders" for Kuova in your phone settings.')}{' '}
          <Text style={styles.noteLink} onPress={openPhoneSettings} accessibilityRole="link">
            {t('Open settings')}
          </Text>
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6, minHeight: 44 },
  switchText: { ...fine.rowTitle, flex: 1 },
  hint: { ...fine.note, marginTop: 0, marginBottom: 6 },
  note: { marginTop: 14, gap: 10 },
  noteHead: { flexDirection: 'row', gap: 8 },
  noteText: { ...ff('regular'), flex: 1, color: FINE.mute, fontSize: 13, lineHeight: 18 },
  noteButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: FINE.jadeLine, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, minHeight: 36, justifyContent: 'center' },
  noteButtonText: { ...ff('regular'), color: FINE.jade, fontSize: 14 },
  noteSmall: { ...ff('regular'), color: FINE.mute, fontSize: 12, lineHeight: 17 },
  noteLink: { ...ff('regular'), color: FINE.jade },
});
