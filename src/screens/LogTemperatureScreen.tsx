import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { KeyboardFooter } from '@/components/KeyboardFooter';
import { CloseButton, FineButton, measureStyles } from '@/components/fine/FineMeasure';
import { basalTemperatureRepository, thermometerRepository } from '@/data/temperatureRepository';
import { dayKey } from '@/data/bathroomRepository';
import { num, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Temperatura basal: al despertar, antes de levantarse, siempre a la misma hora. Se parte de la
// última para que baste con un par de toques. Con ?mode=thermometer es una lectura suelta con
// el termómetro (cualquier hora, varias al día), que no se mezcla con la basal.
// Desde el 2026-11-16, como el registro del peso (LogWeightScreen) y el prototipo: en lugar de las dos ruedas,
// la cifra grande y ligera con «− +» (de 0,05 en 0,05 °C, lo que daban las ruedas; dejarlo pulsado sigue
// contando y tocar la cifra abre el teclado), título con la × de cerrar y un solo botón de Guardar abajo. Los
// límites son los de antes: de 35,00 a 38,95 °C la basal y hasta 41,95 °C con el termómetro (fiebre).

const MIN_DEG = 35;
const STEP = 5; // centésimas

// Pulsar: un paso. Dejarlo pulsado: un paso cada poco hasta soltar (como FineStepper de metas)
function useHold(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  return {
    onPress: () => ref.current(),
    onLongPress: () => {
      stop();
      ref.current();
      timer.current = setInterval(() => ref.current(), 90);
    },
    onPressOut: stop,
  };
}

// «− 36,50 + °C» (prototipo, `.stp`): la cifra se puede tocar y escribir. Va en centésimas para no arrastrar
// decimales de coma flotante
function TempStepper({
  cents,
  min,
  max,
  onStep,
  onSet,
}: {
  cents: number;
  min: number;
  max: number;
  onStep: (d: number) => void;
  onSet: (deg: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const minus = useHold(() => onStep(-STEP));
  const plus = useHold(() => onStep(STEP));
  const commit = () => {
    if (draft == null) return;
    const v = parseFloat(draft.replace(',', '.'));
    if (Number.isFinite(v)) onSet(v);
    setDraft(null);
  };
  return (
    <View style={styles.stp}>
      <TouchableOpacity
        style={[styles.stpBtn, cents <= min && styles.stpOff]}
        disabled={cents <= min}
        {...minus}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={t('Less')}
        hitSlop={4}
      >
        <Text style={styles.stpSign}>−</Text>
      </TouchableOpacity>
      <TextInput
        style={styles.stpVal}
        value={draft ?? num((cents / 100).toFixed(2))}
        onChangeText={(v) => {
          const clean = v.replace(/[^\d.,]/g, '').slice(0, 5);
          setDraft(clean);
          // Lo que ya es una temperatura posible cuenta al momento (por si se pulsa Guardar con el teclado abierto)
          const n = parseFloat(clean.replace(',', '.'));
          if (Number.isFinite(n) && n * 100 >= min && n * 100 <= max) onSet(n);
        }}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        selectTextOnFocus
        returnKeyType="done"
        accessibilityLabel={t('Temperature')}
      />
      <TouchableOpacity
        style={[styles.stpBtn, cents >= max && styles.stpOff]}
        disabled={cents >= max}
        {...plus}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={t('More')}
        hitSlop={4}
      >
        <Text style={styles.stpSign}>+</Text>
      </TouchableOpacity>
      <Text style={styles.stpUnit}>°C</Text>
    </View>
  );
}

export const LogTemperatureScreen = () => {
  const router = useRouter();
  const thermometer = useLocalSearchParams<{ mode?: string }>().mode === 'thermometer';
  const maxDeg = thermometer ? 41 : 38;
  // En centésimas: de 35,00 a 38,95 (o 41,95), de 5 en 5, como las dos ruedas de antes
  const MIN = MIN_DEG * 100;
  const MAX = maxDeg * 100 + 95;
  const [cents, setCents] = useState(3650);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const snap = (c: number) => Math.min(MAX, Math.max(MIN, Math.round(c / STEP) * STEP));
  const place = (deg: number) => setCents(snap(deg * 100));
  const step = (d: number) => setCents((c) => snap(c + d));

  useEffect(() => {
    if (thermometer) {
      thermometerRepository
        .getAll()
        .then((all) => place(all.length ? all.reduce((a, x) => (x.fecha > a.fecha ? x : a)).valor : 36.8))
        .catch(() => place(36.8));
      return;
    }
    basalTemperatureRepository.getAll().then((all) => {
      const today = all.find((x) => dayKey(new Date(x.fecha)) === dayKey(new Date()));
      if (today) {
        place(today.valor);
        setExistingId(today.id);
      } else if (all.length) {
        place(all.reduce((a, x) => (x.fecha > a.fecha ? x : a)).valor);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thermometer]);

  const value = cents / 100;

  const save = async () => {
    setSaving(true);
    try {
      if (thermometer) {
        const now = new Date().toISOString();
        await thermometerRepository.save({ id: `${Date.now()}`, valor: value, unidad: '°C', fecha: now, createdAt: now });
      } else if (existingId) await basalTemperatureRepository.update(existingId, { valor: value });
      else {
        const now = new Date().toISOString();
        await basalTemperatureRepository.save({ id: `${Date.now()}`, valor: value, unidad: '°C', fecha: now, createdAt: now });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title={thermometer ? t('Thermometer reading') : t('Morning temperature')} right={<CloseButton onPress={() => router.back()} />} />

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>
          {thermometer
            ? t('Any time, for example when you feel unwell. It is saved with the time you take it.')
            : t('Take it as soon as you wake up, before getting out of bed, at about the same time each day.')}
        </Text>

        <TempStepper cents={cents} min={MIN} max={MAX} onStep={step} onSet={place} />

        <View style={styles.tip}>
          <Text style={styles.tipText}>
            {thermometer
              ? t('38 °C or more is a fever. Rest and drink fluids; see a doctor if it lasts more than 3 days, goes above 39.5 °C or comes with a stiff neck, a rash or trouble breathing.')
              : t('A digital basal thermometer (two decimals) works best. Illness, alcohol or a bad night can raise it: add a note in your check-in if so.')}
          </Text>
        </View>
      </KeyboardAwareScrollView>

      <KeyboardFooter>
        <View style={measureStyles.footer}>
          <FineButton label={t('Save')} onPress={save} disabled={saving} />
        </View>
      </KeyboardFooter>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  lead: { ...fine.note, marginTop: 0 },
  // «− cifra +» (prototipo, `.stp`): botones redondos con línea fina y la cifra grande y ligera
  stp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 30, marginBottom: 24 },
  stpBtn: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(240,239,230,0.16)', alignItems: 'center', justifyContent: 'center' },
  stpOff: { opacity: 0.35 },
  stpSign: { ...ff('light'), fontSize: 24, lineHeight: 28, color: FINE.ivory, marginTop: -2 },
  // Ancho fijo: en la web un campo de texto grande ocupa media pantalla y echaba fuera el − y el +
  stpVal: { ...ff('light'), width: 132, textAlign: 'center', fontSize: 44, lineHeight: 52, color: FINE.ivory, fontVariant: ['tabular-nums'], padding: 0 },
  stpUnit: { ...ff('regular'), fontSize: 15, color: FINE.mute },
  // El consejo, debajo de una línea fina y sin tarjeta
  tip: { borderTopWidth: 1, borderTopColor: FINE.line, paddingTop: 4 },
  tipText: { ...fine.note },
});
