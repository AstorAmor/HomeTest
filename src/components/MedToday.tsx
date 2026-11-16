// Medicación y suplementos en Hoy, como en el prototipo (borradores/app-estructura/prototipo, 2026-11-16): una fila
// por cada cosa que tomas hoy, con «Siguiente toma · 21:00 · 1 de 2 hoy» y una píldora «Tomada»; con todas las de
// hoy hechas, «Tomada a las 21:02 · 2 de 2 hoy» y «Deshacer» en oro. Saltarse una toma y el resto, en
// Medicación y suplementos (/medications), como siempre.
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FRow, Pill, SecHead } from '@/components/fine/Fine';
import { markDose } from '@/components/DoseRows';
import { setDoseStatus } from '@/data/medicationRepository';
import { fine } from '@/theme/fine';
import { t } from '@/i18n';
import type { ScheduledDose } from '@/types/medication';

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function MedToday({ doses, onChange }: { doses: ScheduledDose[]; onChange: () => void }) {
  const router = useRouter();
  // Un doble toque apuntaba la toma dos veces: mientras se guarda, la fila no responde
  const [busy, setBusy] = useState<string | null>(null);
  const inFlight = useRef(false);
  const run = async (medId: string, fn: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(medId);
    try {
      await fn();
    } finally {
      inFlight.current = false;
      setBusy(null);
      onChange();
    }
  };

  // Agrupadas por medicamento, en el orden de su primera toma del día
  const meds: { id: string; name: string; doses: ScheduledDose[] }[] = [];
  for (const d of [...doses].sort((a, b) => a.at.getTime() - b.at.getTime())) {
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
                busy === m.id ? (
                  <Text style={fine.note}>…</Text>
                ) : pending ? (
                  <Pill label={t('Taken')} onPress={() => run(m.id, () => markDose(pending, 'taken'))} />
                ) : lastDone ? (
                  <Pill gold label={t('Undo')} onPress={() => run(m.id, () => setDoseStatus(lastDone, null, []))} />
                ) : null
              }
            />
          );
        })
      )}
    </View>
  );
}
