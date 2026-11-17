import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pill } from '@/components/fine/Fine';
import { doseRepository } from '@/data/medicationRepository';
import { t } from '@/i18n';
import { DoseLog, ScheduledDose } from '@/types/medication';
import { FINE, ff, fine } from '@/theme/fine';

// Tomas de hoy con su hora y las acciones «Tomada» y «Omitir». Las usa Medicación y suplementos (en Hoy, MedToday
// las agrupa por medicamento).
// Rediseño del 2026-11-17 (lenguaje fino; el fundador: «las "tomas" de medicación no están actualizadas con la
// estética actual»): cada toma es una fila con una línea fina debajo, la hora apagada, el nombre y la dosis, sin el
// icono sobre un círculo de color. Por marcar: «Omitir» como texto apagado y la píldora esmeralda «Tomada», la misma
// que en Hoy. Ya marcada: el texto apagado y la marca redonda (DoseMark).

const DARK = '#061A16'; // la marca sobre el jade

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// La toma marcada ahora, antes de guardarla: Hoy (MedToday) la pinta ya, sin esperar a recargar, y con su id la
// puede deshacer
export function doseLogFor(dose: ScheduledDose, status: DoseLog['status']): DoseLog {
  const at = new Date().toISOString();
  return { id: `${Date.now()}`, fecha: at, createdAt: at, medId: dose.medId, scheduledFor: dose.at.toISOString(), status };
}

export async function markDose(dose: ScheduledDose, status: DoseLog['status']) {
  await doseRepository.save(doseLogFor(dose, status));
}

const doseKey = (d: ScheduledDose) => `${d.medId}-${d.at.toISOString()}`;

// La marca redonda de una toma, como las de marcar del resto de la app (FineMark): tomada, jade con la marca
// oscura; omitida, el aro fino con una raya apagada; sin marcar, el aro fino vacío. `dim`: la que aún no toca.
export function DoseMark({ status, size = 22, dim }: { status?: DoseLog['status']; size?: number; dim?: boolean }) {
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size / 2 }, status === 'taken' && styles.markOn, dim && styles.markDim]}>
      {status === 'taken' ? (
        <Ionicons name="checkmark" size={Math.round(size * 0.62)} color={DARK} />
      ) : status === 'skipped' ? (
        <View style={[styles.dash, { width: Math.max(5, Math.round(size * 0.36)) }]} />
      ) : null}
    </View>
  );
}

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
      {doses.map((d) => {
        const status = d.log?.status ?? justMarked[doseKey(d)];
        return (
          <View key={doseKey(d)} style={fine.row}>
            <Text style={doseStyles.time}>{hhmm(d.at)}</Text>
            <View style={doseStyles.main}>
              <Text style={fine.rowTitle} numberOfLines={2}>
                {t(d.name)}
              </Text>
              {d.dose ? <Text style={fine.rowSub}>{d.dose}</Text> : null}
            </View>
            {status ? (
              <View style={styles.done} accessible accessibilityLabel={status === 'taken' ? t('Taken') : t('Skipped')}>
                <Text style={doseStyles.quiet}>{status === 'taken' ? t('Taken') : t('Skipped')}</Text>
                <DoseMark status={status} />
              </View>
            ) : (
              <>
                <TouchableOpacity style={styles.skip} onPress={() => mark(d, 'skipped')} hitSlop={6} accessibilityRole="button">
                  <Text style={doseStyles.quiet}>{t('Skip')}</Text>
                </TouchableOpacity>
                <Pill label={t('Taken')} onPress={() => mark(d, 'taken')} />
              </>
            )}
          </View>
        );
      })}
    </>
  );
}

// Lo que comparten las filas de tomas de Medicación y suplementos y de su historial
export const doseStyles = StyleSheet.create({
  // La hora, apagada y con cifras de ancho fijo: todas las filas empiezan el nombre en el mismo sitio
  time: { ...ff('regular'), width: 44, color: FINE.mute, fontSize: 13.5, fontVariant: ['tabular-nums'] },
  main: { flex: 1, minWidth: 0 },
  quiet: { ...ff('regular'), color: FINE.mute, fontSize: 13 },
});

const styles = StyleSheet.create({
  mark: { borderWidth: 1, borderColor: 'rgba(240,239,230,0.3)', alignItems: 'center', justifyContent: 'center' },
  markOn: { backgroundColor: FINE.jade, borderColor: FINE.jade },
  markDim: { opacity: 0.45 },
  dash: { height: 1.5, borderRadius: 1, backgroundColor: FINE.mute },
  done: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 6 },
});
