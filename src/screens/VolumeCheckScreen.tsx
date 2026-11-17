import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { ClipPath, Defs, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { ChoiceChips } from '@/components/ChoiceChips';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SecHead } from '@/components/fine/Fine';
import { CloseButton, FineButton, measureStyles } from '@/components/fine/FineMeasure';
import { FOption, ON_BG } from '@/components/fine/FineForm';
import { FineStepper } from '@/components/metas/FineStepper';
import { dayKey, entryForDay, noonOf, urineRepository } from '@/data/bathroomRepository';
import { dailyTotalNote } from '@/logic/bathroom';
import { UrineEntry, VOID_VOLUMES, VoidVolume } from '@/types/bathroom';
import { t } from '@/i18n';
import { FINE, ff, fine, INTER } from '@/theme/fine';

// Volumen exacto: de 50 a 1.000 ml de 10 en 10; el total de 24 h, de 300 a 5.000 de 50 en 50 (lo mismo que daban
// las ruedas de antes)
const ML = { min: 50, max: 1000, step: 10 };
const DAY_ML = { min: 300, max: 5000, step: 50 };
const stepIn = (v: number, d: number, r: { min: number; max: number; step: number }) =>
  Math.min(r.max, Math.max(r.min, Math.round((v + d * r.step) / r.step) * r.step));

// La cantidad aproximada que corresponde a unos ml exactos (para los avisos y las cuentas)
const nearestVolume = (ml: number): VoidVolume => (ml <= 180 ? 'quarter' : ml <= 310 ? 'half' : ml <= 440 ? 'three_quarters' : 'full');

// Vaso de precipitados graduado (hasta 600 ml) que se llena hasta lo elegido. En línea fina apagada; el llenado,
// en el amarillo de la orina (es un dato, no un adorno)
const BEAKER_MAX = 600;
const Beaker = ({ ml }: { ml: number | null }) => {
  const top = 22;
  const bottom = 168;
  const y = (v: number) => bottom - (Math.min(v, BEAKER_MAX) / BEAKER_MAX) * (bottom - top);
  const ticks = Array.from({ length: 11 }, (_, i) => (i + 1) * 50);
  return (
    <Svg width={120} height={180} viewBox="0 0 120 180">
      <Defs>
        <ClipPath id="beakerInside">
          <Path d="M24 14 V160 Q24 170 34 170 H86 Q96 170 96 160 V14 Z" />
        </ClipPath>
      </Defs>
      {ml != null && (
        <Rect x={20} y={y(ml)} width={80} height={bottom + 4 - y(ml)} fill="rgba(237, 211, 92, 0.55)" clipPath="url(#beakerInside)" />
      )}
      {/* Contorno con el pico arriba a la izquierda */}
      <Path
        d="M16 10 L24 16 V160 Q24 170 34 170 H86 Q96 170 96 160 V10"
        stroke={FINE.mute}
        strokeWidth={1.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {ticks.map((v) => (
        <Line key={v} x1={v % 100 === 0 ? 70 : 80} x2={96} y1={y(v)} y2={y(v)} stroke={FINE.mute} strokeOpacity={0.7} strokeWidth={v % 100 === 0 ? 1.2 : 0.8} />
      ))}
      {ticks
        .filter((v) => v % 100 === 0)
        .map((v) => (
          <SvgText key={`l${v}`} x={66} y={y(v) + 3.5} fontSize={10} fontFamily={INTER.regular} fill={FINE.mute} textAnchor="end">
            {v}
          </SvgText>
        ))}
      <SvgText x={60} y={top - 6} fontSize={9} fontFamily={INTER.regular} fill={FINE.mute} textAnchor="middle">
        ml
      </SvgText>
    </Svg>
  );
};

// "Medición rápida de volumen" (desde Hidratación o desde el apunte de la orina): instrucciones,
// cuánto llenó (un cuarto, la mitad… de una botella de 500 ml o en el vaso graduado) y, si se
// sabe, el volumen exacto. Se guarda en el apunte de ese día.
// Desde el 2026-11-16, en el lenguaje fino del prototipo: título con la × de cerrar, sin icono en círculo de
// color ni tarjetas, los pasos numerados en jade, las cantidades con borde fino (la elegida, borde jade), las
// casillas como filas con el círculo de marcar, «− cifra +» en lugar de las ruedas y un solo botón de Guardar abajo.
export const VolumeCheckScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string }>();
  const day = params.day ?? dayKey(new Date());
  const [existing, setExisting] = useState<UrineEntry | null>(null);
  const [level, setLevel] = useState<VoidVolume | undefined>();
  const [exact, setExact] = useState(false);
  const [ml, setMl] = useState(250);
  const [usual, setUsual] = useState<UrineEntry['volumeUsual']>();
  const [showDay, setShowDay] = useState(false);
  const [dayMl, setDayMl] = useState(1500);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    urineRepository.getAll().then((all) => {
      const e = entryForDay(all, day);
      if (!e) return;
      setExisting(e);
      setLevel(e.voidVolume);
      setUsual(e.volumeUsual);
      if (e.voidMl) {
        setExact(true);
        setMl(e.voidMl);
      }
      if (e.dailyTotalMl) {
        setShowDay(true);
        setDayMl(e.dailyTotalMl);
      }
    });
  }, [day]);

  const shownMl = exact ? ml : level ? VOID_VOLUMES.find((v) => v.id === level)!.ml : null;
  const canSave = !!level || exact || showDay;

  const save = async () => {
    setSaving(true);
    const values: Partial<UrineEntry> = {
      voidVolume: exact ? nearestVolume(ml) : level,
      voidMl: exact ? ml : undefined,
      volumeUsual: exact || level ? usual : undefined,
      dailyTotalMl: showDay ? dayMl : undefined,
    };
    try {
      if (existing) await urineRepository.update(existing.id, values);
      else await urineRepository.save({ id: `${Date.now()}`, fecha: noonOf(day), createdAt: new Date().toISOString(), ...values });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title={t('Quick volume check')} right={<CloseButton onPress={() => router.back()} />} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lead}>{t('Once every few months: it gives an idea of how much you pass each time.')}</Text>

        <SecHead title={t('How to do it')} />
        {[
          t('Next time you go, pee into a measuring jug or an empty 500 ml bottle.'),
          t('Leave it on a flat surface and look at the level.'),
          t('Mark it here. If you can read the exact ml, add them below.'),
        ].map((s, i) => (
          <View key={s} style={styles.step}>
            <Text style={styles.stepNumber}>{i + 1}</Text>
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}

        <SecHead title={t('How full was it?')} />
        <View style={styles.beakerRow}>
          <Beaker ml={shownMl} />
          <View style={styles.levels} accessibilityRole="radiogroup">
            {[...VOID_VOLUMES].reverse().map((v) => {
              const on = !exact && level === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.level, on && styles.levelOn]}
                  onPress={() => {
                    setExact(false);
                    setLevel(v.id);
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                >
                  <Text style={[styles.levelText, on && styles.levelTextOn]}>{t(v.label)}</Text>
                  <Text style={styles.levelMl}>≈ {v.ml} ml</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.toggle}>
          <FOption title={t('I know the exact amount')} on={exact} onPress={() => setExact((e) => !e)} multi last={!exact} />
        </View>
        {exact && (
          <FineStepper
            value={String(ml)}
            unit="ml"
            onMinus={() => setMl((v) => stepIn(v, -1, ML))}
            onPlus={() => setMl((v) => stepIn(v, 1, ML))}
            canMinus={ml > ML.min}
            canPlus={ml < ML.max}
            style={styles.stepper}
          />
        )}

        {(level || exact) && (
          <>
            <SecHead title={t('Is that about what you usually pass?')} />
            <ChoiceChips
              options={[
                { id: 'yes', label: t('Yes') },
                { id: 'no', label: t('No') },
                { id: 'unsure', label: t('Not sure') },
              ]}
              value={usual}
              onChange={(v) => setUsual(v as UrineEntry['volumeUsual'])}
            />
            {usual === 'no' && <Text style={styles.note}>{t('Try again another day. Most adults pass about 200–400 ml each time.')}</Text>}
          </>
        )}

        <View style={[styles.toggle, styles.dayToggle]}>
          <FOption
            title={t('I measured a whole day')}
            hint={t('Pharmacies sell 24-hour urine containers. Collect everything for a day and write the total.')}
            on={showDay}
            onPress={() => setShowDay((v) => !v)}
            multi
            last={!showDay}
          />
        </View>
        {showDay && (
          <>
            <FineStepper
              value={String(dayMl)}
              unit={t('ml in 24 h')}
              onMinus={() => setDayMl((v) => stepIn(v, -1, DAY_ML))}
              onPlus={() => setDayMl((v) => stepIn(v, 1, DAY_ML))}
              canMinus={dayMl > DAY_ML.min}
              canPlus={dayMl < DAY_ML.max}
              style={styles.stepper}
            />
            <Text style={[styles.note, styles.center]}>{dailyTotalNote(dayMl).body}</Text>
          </>
        )}
      </ScrollView>

      <View style={measureStyles.footer}>
        <FineButton label={t('Save')} onPress={save} disabled={!canSave || saving} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  lead: { ...fine.note, marginTop: 0 },
  // Cada paso, con su número en jade (sin círculo de color)
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 5 },
  stepNumber: { ...ff('medium'), width: 16, color: FINE.jade, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  stepText: { ...measureStyles.p, flex: 1 },
  beakerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
  levels: { flex: 1, gap: 8 },
  // Cada cantidad, con borde fino; la elegida, borde jade (como los chips)
  level: { borderWidth: 1, borderColor: FINE.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  levelOn: { borderColor: FINE.jade, backgroundColor: ON_BG },
  levelText: { ...ff('regular'), color: FINE.mute, fontSize: 14 },
  levelTextOn: { color: FINE.ivory },
  levelMl: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, marginTop: 1, fontVariant: ['tabular-nums'] },
  // Las casillas, como filas con línea fina
  toggle: { marginTop: 18, borderTopWidth: 1, borderTopColor: FINE.line },
  dayToggle: { marginTop: 28, borderTopColor: FINE.rule },
  stepper: { marginTop: 14, marginBottom: 4 },
  note: { ...fine.note },
  center: { textAlign: 'center' },
});
