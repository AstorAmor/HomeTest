import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { doseRepository } from '@/data/medicationRepository';
import { MedIcon } from './MedIcon';
import { t } from '@/i18n';
import { DoseLog, ScheduledDose } from '@/types/medication';

// Tomas de hoy con su hora y los botones Taken / Skip. Las usan Medication & supplements y la
// tarjeta de Today (allí solo las de lo que tiene recordatorio).

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export async function markDose(dose: ScheduledDose, status: DoseLog['status']) {
  const at = new Date().toISOString();
  await doseRepository.save({ id: `${Date.now()}`, fecha: at, createdAt: at, medId: dose.medId, scheduledFor: dose.at.toISOString(), status });
}

const doseKey = (d: ScheduledDose) => `${d.medId}-${d.at.toISOString()}`;

export function DoseRows({ doses, onChange }: { doses: ScheduledDose[]; onChange: () => void }) {
  // Lo recién tocado se ve marcado ya, sin esperar a que se recargue, y no se puede volver a tocar
  // (un doble toque apuntaba la toma dos veces). Se olvida en cuanto llega guardado.
  const [justMarked, setJustMarked] = useState<Record<string, DoseLog['status']>>({});
  const inFlight = useRef(new Set<string>());
  useEffect(() => {
    setJustMarked((m) => {
      const saved = Object.keys(m).filter((k) => doses.some((d) => d.log && doseKey(d) === k));
      if (!saved.length) return m;
      const next = { ...m };
      for (const k of saved) delete next[k];
      return next;
    });
  }, [doses]);
  const mark = async (d: ScheduledDose, status: DoseLog['status']) => {
    const key = doseKey(d);
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setJustMarked((m) => ({ ...m, [key]: status }));
    try {
      await markDose(d, status);
    } catch (e) {
      setJustMarked(({ [key]: _, ...m }) => m);
      throw e;
    } finally {
      inFlight.current.delete(key);
    }
    onChange();
  };
  return (
    <>
      {doses.map((d, i) => {
        const status = d.log?.status ?? justMarked[doseKey(d)];
        return (
          <View key={doseKey(d)} style={[styles.doseRow, i > 0 && styles.divider]}>
            <Text style={styles.doseTime}>{hhmm(d.at)}</Text>
            <MedIcon name={d.name} kind={d.kind ?? 'medication'} size={15} />
            <View style={{ flex: 1 }}>
              <Text style={styles.doseName}>{t(d.name)}</Text>
              {d.dose ? <Text style={styles.doseSub}>{d.dose}</Text> : null}
            </View>
            {status ? (
              <View style={styles.doneTag}>
                <Ionicons
                  name={status === 'taken' ? 'checkmark-circle' : 'remove-circle-outline'}
                  size={16}
                  color={status === 'taken' ? Colors.ok : Colors.textMuted}
                />
                <Text style={styles.doneText}>{status === 'taken' ? t('Taken') : t('Skipped')}</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity style={styles.skip} onPress={() => mark(d, 'skipped')}>
                  <Text style={styles.skipText}>{t('Skip')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.take} onPress={() => mark(d, 'taken')}>
                  <Text style={styles.takeText}>{t('Taken')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  doseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  doseTime: { width: 46, color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  doseName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  doseSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  take: { backgroundColor: Colors.accent, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  takeText: { color: Colors.background, fontSize: 12, fontWeight: '800' },
  skip: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  skipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  doneTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  doneText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
});
