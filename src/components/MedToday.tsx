// Medicación y suplementos en Hoy, como en el prototipo (borradores/app-estructura/prototipo, 2026-11-16): una fila
// por cada cosa que tomas hoy, con «Siguiente toma · 21:00 · 1 de 2 hoy» y una píldora «Tomada»; con todas las de
// hoy hechas, «Tomada a las 21:02 · 2 de 2 hoy» y «Deshacer» en oro. Saltarse una toma y el resto, en
// Medicación y suplementos (/medications), como siempre.
//
// Al tocar la píldora (fundador, 2026-11-17: «al marcar la medicación como tomada también tiene como un glitch»):
// antes se cambiaba por «…» (la fila encogía y el texto saltaba de línea), al guardar volvía un momento «Tomada» y
// solo después de recargar Hoy entero salía «Deshacer». Ahora la fila cambia al momento (lo tocado se pinta ya, sin
// esperar a guardarlo ni a leerlo), la píldora mide lo mismo con las dos palabras y al guardar solo se vuelven a
// leer las tomas (onChange).
import { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FRow, SecHead } from '@/components/fine/Fine';
import { doseLogFor } from '@/components/DoseRows';
import { doseRepository, setDoseStatus } from '@/data/medicationRepository';
import { fine } from '@/theme/fine';
import { t } from '@/i18n';
import type { DoseLog, ScheduledDose } from '@/types/medication';

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const doseKey = (d: ScheduledDose) => `${d.medId}-${d.at.toISOString()}`;

export function MedToday({ doses, onChange }: { doses: ScheduledDose[]; onChange: () => unknown }) {
  const router = useRouter();
  // Lo tocado que aún no ha vuelto leído: la toma con su registro nuevo, o null si se ha deshecho
  const [local, setLocal] = useState<Record<string, DoseLog | null>>({});
  // Un doble toque apuntaba la toma dos veces: hasta que está guardada y leída otra vez, no se atiende otro toque
  const inFlight = useRef(false);

  const change = async (dose: ScheduledDose, log: DoseLog | null, save: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const key = doseKey(dose);
    setLocal((m) => ({ ...m, [key]: log }));
    try {
      await save();
    } catch (e) {
      console.warn('Dose not saved', e instanceof Error ? e.message : e);
    }
    try {
      await onChange();
    } finally {
      // Ya manda lo leído (si no se ha podido guardar, la fila vuelve a como estaba)
      setLocal(({ [key]: _, ...m }) => m);
      inFlight.current = false;
    }
  };
  const take = (dose: ScheduledDose) => {
    const log = doseLogFor(dose, 'taken');
    change(dose, log, () => doseRepository.save(log));
  };
  const undo = (dose: ScheduledDose) => change(dose, null, () => setDoseStatus(dose, null, []));

  // Con lo recién tocado encima de lo leído
  const shown = doses.map((d) => {
    const k = doseKey(d);
    return k in local ? { ...d, log: local[k] ?? undefined } : d;
  });

  // Agrupadas por medicamento, en el orden de su primera toma del día
  const meds: { id: string; name: string; doses: ScheduledDose[] }[] = [];
  for (const d of [...shown].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    const m = meds.find((x) => x.id === d.medId);
    if (m) m.doses.push(d);
    else meds.push({ id: d.medId, name: d.name, doses: [d] });
  }

  return (
    <View>
      <SecHead title={t('Medication & supplements')} more={t('History')} onMore={() => router.push('/medication-history')} />
      {meds.length === 0 ? (
        <FRow title={t('Add what you take to keep track')} onPress={() => router.push('/medications')} last />
      ) : (
        meds.map((m, i) => {
          const total = m.doses.length;
          const taken = m.doses.filter((d) => d.log?.status === 'taken').length;
          const pending = m.doses.find((d) => !d.log);
          const lastDone = [...m.doses].filter((d) => d.log).sort((a, b) => (b.log!.fecha > a.log!.fecha ? 1 : -1))[0];
          const sub = pending
            ? t('Next dose · {time} · {done} of {total} today', { time: hhmm(pending.at), done: taken, total })
            : lastDone?.log?.status === 'taken'
              ? t('Taken at {time} · {done} of {total} today', { time: hhmm(new Date(lastDone.log.fecha)), done: taken, total })
              : t('{done} of {total} taken today', { done: taken, total });
          return (
            <FRow
              key={m.id}
              title={t(m.name)}
              sub={sub}
              last={i === meds.length - 1}
              onPress={() => router.push('/medications')}
              right={
                pending ? (
                  <DosePill label={t('Taken')} onPress={() => take(pending)} />
                ) : lastDone ? (
                  <DosePill gold label={t('Undo')} onPress={() => undo(lastDone)} />
                ) : null
              }
            />
          );
        })
      )}
    </View>
  );
}

// La píldora de fine (Pill) con el ancho de la palabra más larga de las dos, «Tomada» o «Deshacer», y el mismo borde
// en las dos: al cambiar una por otra, ni ella ni el texto de la fila se mueven
function DosePill({ label, gold, onPress }: { label: string; gold?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[fine.pill, styles.pill, gold && fine.pillGold]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}>
      {[t('Taken'), t('Undo')].map((w) => (
        <Text key={w} style={[fine.pillText, styles.sizer]} aria-hidden importantForAccessibility="no">
          {w}
        </Text>
      ))}
      <Text style={[fine.pillText, gold && fine.pillGoldText]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: { borderWidth: 1, borderColor: 'transparent' },
  // Solo para medir el ancho: sin alto y sin verse
  sizer: { height: 0, opacity: 0 },
});
