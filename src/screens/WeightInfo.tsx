import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FRow, Pill, SecHead } from '@/components/fine/Fine';
import { FineGauge } from '@/components/fine/FineGauge';
import { FineRing } from '@/components/fine/FineLab';
import { mixHex } from '@/components/GlowRing';
import { Colors } from '@/constants/colors';
import { FineLink, measureStyles, SecRow } from '@/components/fine/FineMeasure';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { loadBodyBasics, peekBodyBasics, type BodyBasics } from '@/data/bodyBasics';
import {
  BodyComp,
  latestBodyComp,
  latestBodyFat,
  peekLatestBodyComp,
  peekLatestBodyFat,
  weightRepository,
  type LatestBodyComp,
  type LatestBodyFat,
} from '@/data/weightRepository';
import { loadMeasureReadings, peekMeasureReadings, sampleMeasureReadings } from '@/data/measurementsRepository';
import type { SimpleMetricEntry } from '@/types/simpleMetric';
import { useLengthUnit } from '@/data/lengthUnit';
import { bmi as bmiOf, BMI_RANGE, CompSlice, compositionSlices, weighAdvice } from '@/logic/weight';
import { foldEstimate, jp3Kinds, jp3Sites, latestComplete, MeasureReadings, SiteSummary, summarize, waistToHeight } from '@/logic/bodyMeasures';
import { fatSplit, measureFatCandidates, pickBodyFat, tapeFatSeries, type BodyFatCandidate, type FatSplit } from '@/logic/bodyComposition';
import { lengthFromCm, type LengthUnit } from '@/logic/lengthUnits';
import { sampleBasicsNote, shortDay, tapeFatNote } from '@/screens/measureFormat';
import { dateLocale, num, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Debajo de la gráfica del peso: cuándo toca pesarse, el IMC (con su altura del perfil y lo que no
// dice), la última composición corporal en un donut, las medidas del cuerpo y cómo pesarse bien. Desde el
// 2026-11-16, en fino: sin tarjetas, cada parte con su cabecera pequeña y la leyenda en filas.
// El IMC, neutro (fundador, 2026-11-16: «el peso que te dé el IMC también»): la cifra y, como mucho, el rango de
// la OMS en texto, sin etiquetas de sobrepeso ni colores. Sale también junto al último peso (weight-detail).
// En la demo, sin altura en el perfil, con una de ejemplo y diciéndolo (src/data/bodyBasics.ts).
// «Medidas» (fundador, 2026-11-16): lo último de cada medida de cinta y de pinza (sin el cambio: fundador,
// 2026-11-17, «no pongas en la medida en sí la evolución»; para eso está su evolución), la grasa estimada por
// pliegues y cintura / altura; «Añadir medidas» abre la figura
// (LogMeasurementsScreen) y «Ver evolución» o tocar una medida, su evolución (MeasurementsHistoryScreen). En dos
// columnas de celdas pequeñas para que no ocupe tanto (fundador: «medidas igual ocupa mucho… igual se pueden
// poner dos columnas»).
// Las medidas sirven para algo (fundador, 2026-11-16: «rollo que puedas sobreescribirla, pero que sirvan»): con
// ellas se estima la grasa (pliegues o cinta) y sale una composición corporal de dos partes, grasa y masa sin
// grasa. Qué cifra de grasa manda lo decide pickBodyFat (src/logic/bodyComposition.ts): la del día más reciente
// y, el mismo día, la que se escribe de la báscula antes que los pliegues y que la cinta. Con la de la báscula,
// la composición sale como siempre (grasa, músculo, hueso y resto).

// El anillo de la composición, en el aspecto de ahora (fundador, 2026-11-18: «la circunferencia de la composición
// corporal, quiero que tenga estética actual y separaría entre grasa, músculo, agua y hueso»): FineRing, como el
// rosco de los análisis. Con lo de la báscula, cuatro tramos (grasa en oro, músculo en jade, hueso en marfil y el
// resto apagado) y el agua en un anillo fino por dentro: no es un tramo más porque está repartida en todo lo demás
// (el músculo es agua en sus tres cuartas partes), así que sumada a los tramos daría más que el peso. Con la
// estimación de las medidas, solo grasa y masa sin grasa: partir la masa sin grasa en músculo, hueso y agua con
// fórmulas de población sería poco preciso (el fundador: «si es poco preciso, déjalo como está»).
const SLICE: Record<CompSlice['kind'], { label: string; color: string }> = {
  fat: { label: 'Fat', color: FINE.gold },
  muscle: { label: 'Muscle', color: FINE.jade },
  bone: { label: 'Bone', color: '#D9D2C1' },
  rest: { label: 'Rest (organs, skin…)', color: '#5E7068' },
};
// El agua, en un azul suave hacia el marfil
const WATER = mixHex(Colors.water, FINE.ivory, 0.3);

// La composición que sale de una estimación con las medidas: la cifra elegida, el peso con el que se pasa a
// kilos y, si la hay, la última grasa de la báscula (anterior a la estimación)
interface EstimatedComp {
  pick: BodyFatCandidate;
  weight: number;
  split: FatSplit;
  scale: BodyFatCandidate | null;
}

// La línea del IMC va de 15 a 40: cabe casi cualquier adulto y la franja de la OMS (18,5–24,9) queda a la vista
const BMI_SCALE = { min: 15, max: 40 };

// Corta («18 nov 2026»), para que quepa junto al título de la sección sin partirlo
const longDate = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

// Una fila de la leyenda de la composición: el punto (un aro para el agua, que es el anillo de dentro), el nombre y, a
// la derecha, el % y debajo los kilos apagados (en dos líneas, para que «Masa sin grasa» quepa en una)
function LegendRow({ color, ring, label, pct, kg, last }: { color: string; ring?: boolean; label: string; pct: string; kg?: number; last?: boolean }) {
  return (
    <View style={[styles.legendRow, last && styles.lastRow]}>
      <View style={ring ? [styles.ringDot, { borderColor: color }] : [styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <View style={styles.legendNums}>
        <Text style={styles.legendPct}>{`${pct} %`}</Text>
        {kg != null ? <Text style={styles.legendKg}>{`${num(kg.toFixed(1))} kg`}</Text> : null}
      </View>
    </View>
  );
}

// Las medidas de una herramienta en dos columnas: nombre apagado y la cifra, sin el cambio (fundador, 2026-11-17).
// Tocar una abre su evolución, con su curva. La cinta, en la unidad elegida al apuntar (cm o pulgadas:
// `lengthUnit`); los pliegues, en mm
function MeasureGrid({ title, items, lengthUnit, onOpen }: { title: string; items: SiteSummary[]; lengthUnit: LengthUnit; onOpen: (kind: string) => void }) {
  return (
    <>
      <Text style={styles.group}>{title}</Text>
      <View style={styles.grid}>
        {items.map((s) => {
          const tape = s.site.tool === 'tape';
          const unit = tape ? lengthUnit : s.site.unit;
          const value = tape ? lengthFromCm(s.latest.valor, lengthUnit) : s.latest.valor;
          return (
            <TouchableOpacity
              key={s.site.kind}
              style={styles.cell}
              onPress={() => onOpen(s.site.kind)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${t(s.site.label)}, ${num(value)} ${unit}`}
            >
              <Text style={styles.cellName} numberOfLines={1}>
                {t(s.site.label)}
              </Text>
              <Text style={styles.cellValue} numberOfLines={1}>
                {num(value)}
                <Text style={styles.cellUnit}>{` ${unit}`}</Text>
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

// Lo que lee la parte del peso: la última composición, la última grasa de la báscula, las pesadas, lo del perfil y las
// medidas
interface WeightInfoSources {
  c: LatestBodyComp;
  lastFat: LatestBodyFat;
  entries: SimpleMetricEntry[];
  basics: BodyBasics;
  readings: MeasureReadings;
}

// Lo mismo con lo último leído, sin esperar a la red (undefined si falta algo por leer)
function peekWeightInfoSources(): WeightInfoSources | undefined {
  const c = peekLatestBodyComp();
  const lastFat = peekLatestBodyFat();
  const entries = weightRepository.peek();
  const basics = peekBodyBasics();
  const readings = peekMeasureReadings();
  if (c === undefined || lastFat === undefined || !entries || !basics || !readings) return undefined;
  return { c, lastFat, entries, basics, readings };
}

interface WeightInfoView {
  comp: { fecha: string; values: BodyComp; weight: number | null } | null;
  next: { due: boolean; date: Date | null; tooOften: boolean };
  body: BodyBasics & { bmi: number | null; hasHeight: boolean; minor: boolean };
  measures: { readings: MeasureReadings; sample: boolean };
  estComp: EstimatedComp | null;
}

function weightInfoFrom({ c, lastFat, entries, basics, readings }: WeightInfoSources): WeightInfoView {
  const latest = entries.length ? entries.reduce((a, e) => (e.fecha > a.fecha ? e : a)) : null;
  const weightOn = (iso: string) => entries.find((e) => e.fecha.slice(0, 10) === iso.slice(0, 10))?.valor;
  const a = weighAdvice(entries);
  // Sin medidas propias: las de ejemplo (demo y cuentas de prueba), que nunca se guardan
  const own = summarize(readings).length > 0;
  const sample = own ? null : sampleMeasureReadings();
  const shown = sample ?? readings;
  // Qué grasa manda: la última de la báscula o la estimada con las medidas (pliegues o cinta). Las medidas de
  // ejemplo solo cuentan si no hay ninguna composición propia: lo de ejemplo nunca tapa lo apuntado
  const scale: BodyFatCandidate | null = lastFat ? { pct: lastFat.pct, fecha: lastFat.fecha, source: 'scale' } : null;
  const pick = pickBodyFat([scale, ...(sample && c ? [] : measureFatCandidates(shown, basics))]);
  // Con una estimación, el peso de ese día; si no, el último (o el del perfil)
  const weight = pick && pick.source !== 'scale' ? (weightOn(pick.fecha) ?? latest?.valor ?? basics.weightKg ?? null) : null;
  const split = pick && weight ? fatSplit(weight, pick.pct) : null;
  return {
    // El peso del día de la composición (la báscula la da a la vez); si no, el último
    comp: c ? { ...c, weight: weightOn(c.fecha) ?? latest?.valor ?? null } : null,
    next: { due: a.due, date: a.next, tooOften: a.tooOften },
    // Sexo, edad y altura del perfil; en la demo, con una altura y una persona de ejemplo si faltan (bodyBasics)
    body: {
      ...basics,
      bmi: bmiOf(latest?.valor ?? basics.weightKg, basics.heightCm),
      hasHeight: !!basics.heightCm,
      minor: basics.age !== null && basics.age < 18,
    },
    measures: { readings: shown, sample: !!sample },
    estComp: pick && weight && split ? { pick, weight, split, scale } : null,
  };
}

export const WeightInfo = () => {
  const router = useRouter();
  // Con cuenta, nace con lo último leído (pesadas, composición, medidas y perfil) y lo refresca de la red detrás, en vez
  // de aparecer un segundo después de la gráfica (fundador, 2026-11-17: «las medidas tardan en cargar»)
  const [cached] = useState(() => {
    const src = peekWeightInfoSources();
    return src ? weightInfoFrom(src) : null;
  });
  const [comp, setComp] = useState<WeightInfoView['comp']>(cached?.comp ?? null);
  const [next, setNext] = useState<WeightInfoView['next'] | null>(cached?.next ?? null);
  const [estComp, setEstComp] = useState<EstimatedComp | null>(cached?.estComp ?? null);
  const [body, setBody] = useState<WeightInfoView['body'] | null>(cached?.body ?? null);
  const [bmiOpen, setBmiOpen] = useState(false);
  const [measures, setMeasures] = useState<WeightInfoView['measures'] | null>(cached?.measures ?? null);
  const [lengthUnit] = useLengthUnit();
  const firstLoad = useRef(true);

  useReloadOnFocus(
    useCallback(async () => {
      const apply = (v: WeightInfoView) => {
        setComp(v.comp);
        setNext(v.next);
        setBody(v.body);
        setMeasures(v.measures);
        setEstComp(v.estComp);
      };
      // Al volver de apuntar un peso o unas medidas, lo último leído ya lo lleva: se ve al momento
      if (!firstLoad.current) {
        const src = peekWeightInfoSources();
        if (src) apply(weightInfoFrom(src));
      }
      firstLoad.current = false;
      // Todo a la vez: la composición, la grasa, las pesadas y las medidas salen en UNA petición
      // (src/data/metricBatch.ts) y el perfil se comparte con la ficha (src/data/readCache.ts)
      const [c, lastFat, entries, basics, readings] = await Promise.all([
        latestBodyComp(),
        latestBodyFat().catch(() => null),
        weightRepository.getAll(),
        loadBodyBasics(),
        loadMeasureReadings().catch(() => ({}) as MeasureReadings),
      ]);
      apply(weightInfoFrom({ c, lastFat, entries, basics, readings }));
    }, []),
  );

  const day = (d: Date) => d.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
  // El resto, solo si llega al 1 %: cuando la báscula casi suma el peso, un tramo de «0 %» no dice nada
  const slices = comp?.weight ? (compositionSlices(comp.weight, comp.values)?.filter((s) => s.kind !== 'rest' || s.kg / comp.weight! >= 0.01) ?? null) : null;
  const whoRange = `${num(BMI_RANGE.min)}–${num(BMI_RANGE.max)}`;
  const addHeight = () => router.push({ pathname: '/profile', params: { edit: 'height' } });
  const openHistory = (kind: string) => router.push({ pathname: '/measurements-history', params: { kind } });

  // Medidas: lo último de cada una; la grasa estimada con la última vez que se tomaron los 3 pliegues de su sexo
  // y, con la cinta, con la última vez que se midieron el cuello y la cintura (y la cadera en mujeres)
  const tape = measures ? summarize(measures.readings, 'tape') : [];
  const folds = measures ? summarize(measures.readings, 'fold') : [];
  const lastDate = [...tape, ...folds].reduce((a, s) => (s.latest.fecha > a ? s.latest.fecha : a), '');
  const sex = body?.sex === 'male' || body?.sex === 'female' ? body.sex : null;
  const jp = sex && measures ? latestComplete(measures.readings, jp3Kinds(sex)) : null;
  const estimate =
    sex && jp ? foldEstimate(sex, body?.age, Object.fromEntries(jp3Sites(sex).map((id) => [id, jp.values[`skinfold_${id}`]]))) : null;
  const whtr = waistToHeight(tape.find((s) => s.site.id === 'waist')?.latest.valor, body?.heightCm);
  const tapeFat = measures && body ? tapeFatSeries(measures.readings, body.sex, body.heightCm).slice(-1)[0] : undefined;
  // En la demo, con el perfil a medias: con qué datos de ejemplo salen las cuentas (si las medidas también son de
  // ejemplo, basta con su aviso)
  const measuresBasicsNote = measures?.sample ? null : sampleBasicsNote(body, { person: estimate?.kind === 'ok' || !!tapeFat, height: whtr != null || !!tapeFat });
  const estBasicsNote = estComp && !measures?.sample ? sampleBasicsNote(body, { person: true, height: estComp.pick.source === 'tape' }) : null;
  const estSource = !estComp
    ? ''
    : estComp.pick.source === 'folds'
      ? t('Body fat estimated from your skinfolds on {date}.', { date: shortDay(estComp.pick.fecha) })
      : body?.sex === 'female'
        ? t('Body fat estimated from your tape measure (neck, waist, hips and height) on {date}.', { date: shortDay(estComp.pick.fecha) })
        : t('Body fat estimated from your tape measure (neck, waist and height) on {date}.', { date: shortDay(estComp.pick.fecha) });

  return (
    <View>
      {next && (
        <View style={styles.next}>
          <Ionicons name="calendar-outline" size={17} color={FINE.jade} />
          <Text style={styles.nextText}>
            {next.due || !next.date ? t('Time to weigh yourself.') : t('Next weigh-in: {day}.', { day: day(next.date) })}
            {next.tooOften ? ` ${t('You have weighed yourself 3 or more times this week: once a week is enough.')}` : ''}
          </Text>
        </View>
      )}

      {body && (
        <>
          <SecHead title={t('Body mass index (BMI)')} />
          {body.bmi != null ? (
            <>
              <FRow
                title={t('Your BMI')}
                sub={body.minor ? t('Under 18, BMI is read with charts by age and sex: take it as a guide.') : undefined}
                value={`${num(body.bmi.toFixed(1))} kg/m²`}
                last
              />
              {/* En una línea, como los marcadores (fundador, 2026-11-18: «el IMC lo ubicaría también en una línea»):
                  la franja jade es el rango de la OMS y el punto de luz, tu IMC. Neutro: sin más tramos ni colores.
                  En menores no: su rango va por edad y sexo */}
              {!body.minor && (
                <View style={styles.bmiLine} accessible accessibilityLabel={t('WHO range: {range}', { range: whoRange })}>
                  <FineGauge
                    min={BMI_SCALE.min}
                    max={BMI_SCALE.max}
                    value={body.bmi}
                    range={[BMI_RANGE.min, BMI_RANGE.max]}
                    edgeLabels={[num(BMI_RANGE.min), num(BMI_RANGE.max)]}
                  />
                  <Text style={styles.bmiCaption}>{t('The band is the WHO range for adults.')}</Text>
                </View>
              )}
              {/* Demo sin altura en el perfil: el IMC sale con una de ejemplo y se dice */}
              {body.sampleHeight && (
                <TouchableOpacity onPress={addHeight} hitSlop={8} accessibilityRole="link">
                  <Text style={[fine.note, styles.sampleLine]}>
                    {t('With a sample height ({h} cm).', { h: body.heightCm ?? '' })} <Text style={fine.link}>{t('Add your height')}</Text>
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity onPress={() => (body.hasHeight ? router.push('/log-weight') : addHeight())} hitSlop={8} accessibilityRole="link">
              <Text style={measureStyles.p}>
                {body.hasHeight ? t('Log your weight and we will work out your BMI.') : t('Add your height to your profile and we will work out your BMI.')}{' '}
                <Text style={fine.link}>{body.hasHeight ? '' : t('Add your height')}</Text>
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.more}
            onPress={() => setBmiOpen((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ expanded: bmiOpen }}
          >
            <Text style={fine.link}>{t('What it does and does not tell you')}</Text>
            <Ionicons name={bmiOpen ? 'chevron-up' : 'chevron-down'} size={14} color={FINE.jade} />
          </TouchableOpacity>
          {bmiOpen && (
            <Text style={measureStyles.p}>
              {t('BMI compares your weight with your height. It is a population reference, not a measure of your health: it does not tell muscle from fat or where the fat is. With a lot of muscle it comes out high without excess fat, and with little muscle it can look normal even if fat is high. That is why your body composition and your waist measurement say more.')}
            </Text>
          )}
        </>
      )}

      {/* Composición corporal. Con una estimación de las medidas (SUPUESTO, revisión clínica: JP3 + Siri en
          src/logic/bodyMeasures.ts y Marina de EE. UU. en src/logic/bodyComposition.ts): grasa y masa sin grasa,
          de dónde sale y que la grasa que se escriba de la báscula la sustituye. Con la de la báscula, como siempre */}
      {estComp ? (
        <>
          <SecRow title={t('Body composition')} right={<Text style={styles.date}>{longDate(estComp.pick.fecha)}</Text>} />
          <View style={styles.donutRow}>
            <FineRing
              parts={[
                { value: estComp.split.fatKg, color: FINE.gold },
                { value: estComp.split.leanKg, color: FINE.jade },
              ]}
              size={112}
              stroke={6}
              label={`${num(estComp.weight)}`}
              sub="kg"
              accessibilityLabel={`${t('Fat')} ${num(estComp.split.fatPct)} %, ${t('Fat-free mass')} ${num(estComp.split.leanPct)} %`}
            />
            <View style={styles.legend}>
              <LegendRow color={FINE.gold} label={t('Fat')} pct={num(estComp.split.fatPct)} kg={estComp.split.fatKg} />
              <LegendRow color={FINE.jade} label={t('Fat-free mass')} pct={num(estComp.split.leanPct)} kg={estComp.split.leanKg} last />
            </View>
          </View>
          <Text style={[measureStyles.p, styles.source]}>{estSource}</Text>
          <Text style={fine.note}>
            {t('It is an estimate: compare it between measurements taken the same way. If you type the body fat from your scale when you weigh in, we will use that instead.')}
          </Text>
          {estComp.scale && (
            <Text style={fine.note}>{t('Last figure from your scale: {v} % on {date}.', { v: num(estComp.scale.pct), date: shortDay(estComp.scale.fecha) })}</Text>
          )}
          {measures?.sample ? (
            <Text style={fine.note}>{t('Sample data: log your first reading to see your own.')}</Text>
          ) : estBasicsNote ? (
            <Text style={fine.note}>{estBasicsNote}</Text>
          ) : null}
        </>
      ) : comp ? (
        <>
          <SecRow title={t('Body composition')} right={<Text style={styles.date}>{longDate(comp.fecha)}</Text>} />
          {slices && comp.weight ? (
            <View style={styles.donutRow}>
              <FineRing
                parts={slices.map((s) => ({ value: s.kg, color: SLICE[s.kind].color }))}
                size={112}
                stroke={6}
                label={`${num(comp.weight)}`}
                sub="kg"
                inner={comp.values.body_water != null ? { fraction: comp.values.body_water / 100, color: WATER } : undefined}
                accessibilityLabel={slices.map((s) => `${t(SLICE[s.kind].label)} ${num(s.kg.toFixed(1))} kg`).join(', ')}
              />
              <View style={styles.legend}>
                {slices.map((s, i) => (
                  <LegendRow
                    key={s.kind}
                    color={SLICE[s.kind].color}
                    label={t(SLICE[s.kind].label)}
                    pct={`${Math.round((s.kg / comp.weight!) * 100)}`}
                    kg={s.kg}
                    last={i === slices.length - 1 && comp.values.body_water == null}
                  />
                ))}
                {/* El agua: un aro en vez de un punto, porque es el anillo de dentro */}
                {comp.values.body_water != null && <LegendRow color={WATER} ring label={t('Water')} pct={num(comp.values.body_water)} last />}
              </View>
            </View>
          ) : (
            <Text style={measureStyles.p}>
              {comp.values.body_water != null ? t('Water: {v} % (spread across all of it)', { v: num(comp.values.body_water) }) : '—'}
            </Text>
          )}
          {slices && comp.values.body_water != null ? (
            <Text style={fine.note}>{t('Water is spread across everything else, so it goes in the inner ring and not as one more part.')}</Text>
          ) : null}
          <Text style={fine.note}>{t('Home scales estimate it from your hydration: compare it between weigh-ins in the same conditions.')}</Text>
        </>
      ) : body ? (
        // Sin composición todavía: de dónde puede salir y cómo apuntarla, en vez de no decir nada
        <>
          <SecRow title={t('Body composition')} />
          <Text style={measureStyles.p}>{t('Copy it from your scale or estimate it from your measurements when you log your weight.')}</Text>
          <View style={styles.addCol}>
            <Pill label={t('Add')} onPress={() => router.push('/log-weight')} />
          </View>
        </>
      ) : null}

      {/* Medidas: cinta métrica y pinza de grasa, con la figura para apuntarlas, y para qué sirven */}
      {measures && (
        <>
          <SecRow title={t('Body measurements')} right={lastDate ? <Text style={styles.date}>{longDate(lastDate)}</Text> : undefined} />
          {tape.length || folds.length ? (
            <>
              <Text style={[fine.note, styles.purpose]}>{t('With them we work out your waist / height and estimate your body fat and body composition.')}</Text>
              {tape.length > 0 && <MeasureGrid title={t('Tape measure')} items={tape} lengthUnit={lengthUnit} onOpen={openHistory} />}
              {whtr != null && (
                <FRow
                  title={t('Waist / height')}
                  sub={t('As a reference, a waist under half your height is usually advised.')}
                  value={num(whtr.toFixed(2))}
                  onPress={() => openHistory('whtr')}
                  style={styles.lineRow}
                  last={!tapeFat}
                />
              )}
              {/* SUPUESTO (revisión clínica): Marina de EE. UU., ver src/logic/bodyComposition.ts */}
              {tapeFat && (
                <FRow
                  title={t('Estimated body fat (tape)')}
                  sub={tapeFatNote(body?.sex)}
                  value={`${num(tapeFat.valor)} %`}
                  onPress={() => openHistory('fat_tape')}
                  style={styles.lineRow}
                  last
                />
              )}
              {folds.length > 0 && <MeasureGrid title={t('Skinfold caliper')} items={folds} lengthUnit={lengthUnit} onOpen={openHistory} />}
              {/* SUPUESTO (revisión clínica): JP3 + Siri, ver src/logic/bodyMeasures.ts */}
              {estimate?.kind === 'ok' && (
                <FRow
                  title={t('Estimated body fat')}
                  sub={t('Estimate from your skinfolds; compare it between measurements taken the same way.')}
                  value={`${num(estimate.pct)} %`}
                  onPress={() => openHistory('fat')}
                  style={styles.lineRow}
                  last
                />
              )}
            </>
          ) : (
            <Text style={measureStyles.p}>
              {t('Tape measure and skinfolds, on a figure: they show changes the scale does not.')}{' '}
              {t('With them we work out your waist / height and estimate your body fat and body composition.')}
            </Text>
          )}
          {measures.sample ? (
            <Text style={fine.note}>{t('Sample data: log your first reading to see your own.')}</Text>
          ) : measuresBasicsNote ? (
            <Text style={fine.note}>{measuresBasicsNote}</Text>
          ) : null}
          {/* Los botones, centrados (fundador, 2026-11-18: «el botón aparece a la izquierda, debería estar centrado») */}
          <View style={styles.addCol}>
            <Pill label={t('Add measurements')} onPress={() => router.push('/log-measurements')} />
            {tape.length || folds.length ? <FineLink label={t('See history')} icon="analytics-outline" onPress={() => router.push('/measurements-history')} /> : null}
          </View>
        </>
      )}

      <SecHead title={t('How to weigh yourself')} />
      <Text style={measureStyles.p}>
        {t('Once a week, on the same day: in the morning, after the toilet and before eating or drinking, with little clothing and on the same scale. Weight changes 1–2 kg from one day to the next with what you ate, salt, fluid retention or your menstrual cycle, so a single weigh-in says little. Look at the trend over several weeks.')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  // Cuándo toca pesarse: una línea con su icono, entre dos líneas finas
  next: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 22, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: FINE.line },
  nextText: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 14, lineHeight: 20 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 10, marginBottom: 6, minHeight: 32 },
  // «Con una altura de ejemplo (176 cm). Añade tu altura», pegada al IMC
  sampleLine: { marginTop: 0 },
  // La línea del IMC, pegada a su fila
  bmiLine: { marginTop: -4, marginBottom: 8 },
  bmiCaption: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, marginTop: 4 },
  // De dónde sale la grasa estimada, bajo el donut
  source: { marginTop: 12 },
  // Para qué sirven las medidas, bajo la cabecera
  purpose: { marginTop: 0 },
  date: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  legend: { flex: 1 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: FINE.line },
  lastRow: { borderBottomWidth: 0 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  ringDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  legendLabel: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 13.5 },
  legendNums: { alignItems: 'flex-end' },
  legendPct: { ...ff('regular'), color: FINE.ivory, fontSize: 13.5, lineHeight: 17, fontVariant: ['tabular-nums'] },
  legendKg: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, lineHeight: 14, fontVariant: ['tabular-nums'] },
  // «Cinta métrica» / «Pinza de grasa» dentro de Medidas
  group: { ...fine.kicker, marginTop: 12, marginBottom: 2 },
  // Dos columnas de celdas pequeñas, cada una con su línea fina debajo
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', paddingVertical: 7, paddingRight: 10, borderBottomWidth: 1, borderBottomColor: FINE.line, minHeight: 50 },
  cellName: { ...ff('regular'), fontSize: 12, color: FINE.mute },
  cellValue: { ...fine.num, fontSize: 19, lineHeight: 24, marginTop: 1 },
  cellUnit: { ...ff('regular'), fontSize: 11.5, color: FINE.mute },
  lineRow: { minHeight: 0 },
  addCol: { alignItems: 'center', gap: 8, marginTop: 16 },
});
