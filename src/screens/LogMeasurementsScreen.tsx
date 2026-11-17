import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BodyHologram } from '@/components/BodyHologram';
import { MeasureTabs } from '@/components/MeasureTabs';
import { DateTimeSheet } from '@/components/DateTimeSheet';
import { ScreenHeader } from '@/components/ScreenHeader';
import { KeyboardFooter } from '@/components/KeyboardFooter';
import { LengthUnitSwitch } from '@/components/LengthUnitSwitch';
import { FRow } from '@/components/fine/Fine';
import { CloseButton, FineButton, measureStyles } from '@/components/fine/FineMeasure';
import { formStyles } from '@/components/fine/FineForm';
import { useLengthUnit } from '@/data/lengthUnit';
import { loadMeasureReadings, saveMeasureSession } from '@/data/measurementsRepository';
import { loadBodyBasics, type BodyBasics } from '@/data/bodyBasics';
import {
  FOLD_SITES,
  TAPE_SITES,
  foldEstimate,
  jp3Sites,
  parseMeasure,
  sitesOf,
  summarize,
  waistToHeight,
  type FoldId,
  type MeasureReading,
  type MeasureSite,
  type MeasureTool,
  type TapeId,
} from '@/logic/bodyMeasures';
import { tapeFatEstimate } from '@/logic/bodyComposition';
import { figureSexOf } from '@/logic/bodyFigure';
import { convertTyped, lengthFromCm, parseLength, type LengthUnit } from '@/logic/lengthUnits';
import { sampleBasicsNote, tapeFatNote } from '@/screens/measureFormat';
import { dateLocale, num, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Apuntar medidas del cuerpo (Peso → Medidas): arriba, cinta métrica o pinza de grasa; a la izquierda, la figura
// como un holograma (BodyHologram) y a la derecha, la lista de sitios. Al tocar un sitio (o su marca en la
// figura), la figura se acerca a su zona y la marca se ilumina; debajo del nombre sale cómo se mide. Con los
// tres pliegues de Jackson-Pollock de tu sexo, la grasa estimada; con la cintura y tu altura, cintura / altura; y
// con el cuello y la cintura (y la cadera en mujeres) y tu altura, la grasa estimada con la cinta (fundador,
// 2026-11-16: que las medidas «sirvan»). Sexo, edad y altura salen del perfil (en la demo, de ejemplo si faltan:
// src/data/bodyBasics.ts).
// La figura va fija y solo se desplaza la lista: así se ve el zoom también con el teclado abierto.
// Con el teclado abierto (fundador, 2026-11-16: «ojo que el teclado no tape las cosas para salir y eso»): la
// cabecera con la X va fuera de la lista y no se mueve, «Guardar» sube con el teclado (KeyboardFooter), la fila
// elegida se vuelve a subir cuando el teclado ya está fuera (la lista se ha encogido) y arrastrar la lista
// cierra el teclado (el teclado numérico del iPhone no tiene tecla para cerrarlo).
// ?tool=fold abre en la pinza.
// La cinta, en cm o en pulgadas (fundador, 2026-11-16: «quiero que puedas cambiar las unidades (inch - cm)»): el
// interruptor «cm | in» va encima de las casillas, solo en la cinta (los pliegues siempre en mm). Se guarda en cm.
// Cada casilla recuerda en qué unidad se escribió: al cambiar de unidad se enseña pasada a la otra y, al volver,
// tal cual se escribió (ir y venir no la redondea), y lo que se guarda sale siempre de lo escrito.
const formatDate = (date: Date) => date.toLocaleDateString(dateLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

export const LogMeasurementsScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ tool?: string }>();
  const [tool, setTool] = useState<MeasureTool>(params.tool === 'fold' ? 'fold' : 'tape');
  const [raw, setRaw] = useState<Record<string, string>>({}); // lo escrito, por kind
  const [rawUnit, setRawUnit] = useState<Record<string, LengthUnit>>({}); // en qué unidad se escribió cada medida de cinta
  const [unit, setUnit] = useLengthUnit();
  const [focus, setFocus] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [picking, setPicking] = useState(false);
  const [last, setLast] = useState<Record<string, MeasureReading>>({});
  const [profile, setProfile] = useState<BodyBasics>({ age: null, sampleHeight: false, samplePerson: false });
  const [saving, setSaving] = useState(false);
  const inputs = useRef<Record<string, TextInput | null>>({});
  const rowY = useRef<Record<string, number>>({});
  const list = useRef<ScrollView>(null);

  // Cuando el teclado acaba de salir, la lista ya es más corta: volver a subir la fila elegida
  const focusRef = useRef<string | null>(null);
  focusRef.current = focus;
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      const kind = focusRef.current;
      if (kind) setTimeout(() => reveal(kind), 30);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    loadMeasureReadings()
      .then((r) => setLast(Object.fromEntries(summarize(r).map((s) => [s.site.kind, s.latest]))))
      .catch(() => undefined);
    loadBodyBasics()
      .then(setProfile)
      .catch(() => undefined);
  }, []);

  const sites = sitesOf(tool);
  const all = [...sitesOf('tape'), ...FOLD_SITES];
  const values: Record<string, number> = {};
  const invalid: string[] = [];
  for (const s of all) {
    const r = raw[s.kind]?.trim();
    if (!r) continue;
    // La cinta, en cm con un decimal desde la unidad en que se escribió
    const v = s.tool === 'tape' ? parseLength(s, r, rawUnit[s.kind] ?? unit) : parseMeasure(s, r);
    if (v == null) invalid.push(s.kind);
    else values[s.kind] = v;
  }
  const filled = Object.fromEntries(Object.keys(values).map((k) => [k, true]));
  const count = Object.keys(values).length;
  // La unidad que se enseña y una cifra guardada (cm o mm) en ella
  const unitOf = (s: MeasureSite) => (s.tool === 'tape' ? unit : s.unit);
  const shownValue = (s: MeasureSite, v: number) => num(s.tool === 'tape' ? lengthFromCm(v, unit) : v);
  // Lo escrito en la casilla: si se escribió en la otra unidad, pasado a la de ahora
  const typed = (s: MeasureSite) => {
    const r = raw[s.kind] ?? '';
    const from = rawUnit[s.kind];
    if (s.tool !== 'tape' || !from || from === unit) return r;
    const v = convertTyped(r, from, unit);
    return v == null ? r : num(v);
  };
  const focusSite = all.find((s) => s.kind === focus);
  const focusLabel = focusSite && values[focusSite.kind] != null ? `${shownValue(focusSite, values[focusSite.kind])} ${unitOf(focusSite)}` : undefined;

  // La fila del sitio elegido, arriba en la lista (con el teclado abierto, la lista se encoge)
  const reveal = (kind: string) => list.current?.scrollTo({ y: Math.max(0, (rowY.current[kind] ?? 0) - 8), animated: true });
  const onFocusField = (kind: string) => {
    setFocus(kind);
    if (Platform.OS !== 'web') setTimeout(() => reveal(kind), 320);
  };
  // Tocar una marca de la figura: su campo
  const pick = (kind: string) => {
    setFocus(kind);
    reveal(kind);
    inputs.current[kind]?.focus();
  };
  const switchTool = (next: MeasureTool) => {
    if (next === tool) return;
    Keyboard.dismiss();
    setFocus(null);
    setTool(next);
    list.current?.scrollTo({ y: 0, animated: false });
  };

  const onPickerChange = (_e: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setPicking(false);
    if (!selected) return;
    setDate((prev) => {
      const next = new Date(prev);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      return next;
    });
  };

  const save = async () => {
    if (!count || invalid.length) return;
    setSaving(true);
    try {
      await saveMeasureSession({ fecha: date.toISOString(), values });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  // Lo que sale de lo escrito: grasa estimada (pinza), y cintura / altura y grasa estimada (cinta)
  const folds: Partial<Record<FoldId, number>> = Object.fromEntries(FOLD_SITES.filter((s) => values[s.kind] != null).map((s) => [s.id, values[s.kind]]));
  const estimate = foldEstimate(profile.sex, profile.age, folds);
  const anyFold = Object.keys(folds).length > 0;
  const whtr = waistToHeight(values.tape_waist, profile.heightCm);
  const tapes: Partial<Record<TapeId, number>> = Object.fromEntries(TAPE_SITES.filter((s) => values[s.kind] != null).map((s) => [s.id, values[s.kind]]));
  const tapeFat = tapeFatEstimate(profile.sex, profile.heightCm, tapes);
  const anyTape = Object.keys(tapes).length > 0;
  const siteNames = (ids: FoldId[]) => ids.map((id) => t(FOLD_SITES.find((s) => s.id === id)!.label).toLowerCase()).join(', ');
  const tapeNames = (ids: TapeId[]) => ids.map((id) => t(TAPE_SITES.find((s) => s.id === id)!.label).toLowerCase()).join(', ');
  // En la demo, con el perfil a medias: con qué datos de ejemplo sale lo de esta pestaña
  const basicsNote =
    tool === 'fold'
      ? sampleBasicsNote(profile, { person: anyFold && estimate.kind === 'ok' })
      : sampleBasicsNote(profile, { person: anyTape && tapeFat.kind === 'ok', height: whtr != null || (anyTape && tapeFat.kind === 'ok') });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title={t('Body measurements')} right={<CloseButton onPress={() => router.back()} />} />

      {/* Cinta métrica · Pinza de grasa, con cuántas van rellenas */}
      <MeasureTabs
        style={styles.tabs}
        value={tool}
        onChange={switchTool}
        counts={{ tape: sitesOf('tape').filter((x) => values[x.kind] != null).length, fold: FOLD_SITES.filter((x) => values[x.kind] != null).length }}
      />

      <View style={styles.main}>
        <BodyHologram style={styles.figure} sex={figureSexOf(profile.sex)} tool={tool} focus={focus} filled={filled} focusLabel={focusLabel} onPick={pick} />

        <ScrollView
          ref={list}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.lead}>
            {tool === 'tape'
              ? t('On bare skin, snug without pressing. Tap a measure to see where it goes.')
              : t('Pinch the fold, caliper 1 cm away, read it after 2 seconds. Always on the same side.')}
          </Text>
          {/* «cm | in» encima de la columna de las casillas y de su ancho: en la fila de las pestañas no cabe en un
              móvil estrecho cuando ya llevan su número */}
          {tool === 'tape' && <LengthUnitSwitch style={styles.unitSwitch} value={unit} onChange={setUnit} />}

          {sites.map((s, i) => {
            const on = focus === s.kind;
            const bad = invalid.includes(s.kind);
            const prev = last[s.kind];
            const next = sites[i + 1];
            return (
              <TouchableOpacity
                key={s.kind}
                style={[styles.row, i === sites.length - 1 && styles.lastRow]}
                onPress={() => inputs.current[s.kind]?.focus()}
                onLayout={(e) => {
                  rowY.current[s.kind] = e.nativeEvent.layout.y;
                }}
                activeOpacity={0.7}
                accessible={false}
              >
                <View style={styles.rowText}>
                  <Text style={[fine.rowTitle, styles.rowTitle]} numberOfLines={2} maxFontSizeMultiplier={1.15}>
                    {t(s.label)}
                  </Text>
                  {on ? (
                    <Text style={styles.hint}>{t(s.hint)}</Text>
                  ) : prev ? (
                    <Text style={fine.rowSub} numberOfLines={1}>
                      {t('Last time: {v}', { v: `${shownValue(s, prev.valor)} ${unitOf(s)}` })}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.inputWrap, on && styles.inputOn, bad && styles.inputBad]}>
                  <TextInput
                    ref={(r) => {
                      inputs.current[s.kind] = r;
                    }}
                    style={styles.input}
                    value={typed(s)}
                    onChangeText={(v) => {
                      setRaw((x) => ({ ...x, [s.kind]: v.replace(/[^\d.,]/g, '').slice(0, 5) }));
                      if (s.tool === 'tape') setRawUnit((x) => ({ ...x, [s.kind]: unit }));
                    }}
                    onFocus={() => onFocusField(s.kind)}
                    keyboardType="decimal-pad"
                    returnKeyType={next ? 'next' : 'done'}
                    blurOnSubmit={!next}
                    onSubmitEditing={() => (next ? inputs.current[next.kind]?.focus() : Keyboard.dismiss())}
                    placeholder="—"
                    placeholderTextColor={FINE.mute}
                    selectTextOnFocus
                    maxFontSizeMultiplier={1.2}
                    accessibilityLabel={`${t(s.label)}, ${unitOf(s)}`}
                    accessibilityHint={t(s.hint)}
                  />
                  <Text style={styles.unit} numberOfLines={1} maxFontSizeMultiplier={1.15}>
                    {unitOf(s)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {invalid.length ? <Text style={[formStyles.error, styles.after]}>{t('Check the marked values: they are outside what is possible for that measure.')}</Text> : null}

          {/* Pinza: la grasa estimada con los tres pliegues de tu sexo (SUPUESTO en src/logic/bodyMeasures.ts) */}
          {tool === 'fold' && anyFold && (
            <View style={styles.result}>
              {estimate.kind === 'ok' ? (
                <>
                  <View style={styles.resultRow}>
                    <Text style={[fine.rowTitle, styles.flex]}>{t('Estimated body fat')}</Text>
                    <Text style={styles.resultValue}>{num(estimate.pct)} %</Text>
                  </View>
                  <Text style={styles.note}>{t('Estimate from your skinfolds; compare it between measurements taken the same way.')}</Text>
                  <Text style={styles.note}>
                    {t('Jackson-Pollock formula with 3 skinfolds: {sites}.', { sites: siteNames(jp3Sites(profile.sex === 'male' ? 'male' : 'female')) })}
                  </Text>
                </>
              ) : estimate.kind === 'missing' ? (
                <Text style={styles.note}>{t('For a body fat estimate, also fill in: {sites}.', { sites: siteNames(estimate.sites) })}</Text>
              ) : (
                <Text style={styles.note}>{t('For a body fat estimate we need your sex and date of birth in your profile: the formulas depend on them.')}</Text>
              )}
            </View>
          )}

          {/* Cinta: cintura / altura, con la altura del perfil. Sin colores ni avisos */}
          {tool === 'tape' && whtr != null && (
            <View style={styles.result}>
              <View style={styles.resultRow}>
                <Text style={[fine.rowTitle, styles.flex]}>{t('Waist / height')}</Text>
                <Text style={styles.resultValue}>{num(whtr.toFixed(2))}</Text>
              </View>
              <Text style={styles.note}>{t('As a reference, a waist under half your height is usually advised.')}</Text>
            </View>
          )}

          {/* Cinta: la grasa estimada con el cuello, la cintura (y la cadera en mujeres) y la altura del perfil
              (SUPUESTO en src/logic/bodyComposition.ts), lo que falta por rellenar o que hace falta el perfil */}
          {tool === 'tape' && anyTape && (
            <View style={styles.result}>
              {tapeFat.kind === 'ok' ? (
                <>
                  <View style={styles.resultRow}>
                    <Text style={[fine.rowTitle, styles.flex]}>{t('Estimated body fat')}</Text>
                    <Text style={styles.resultValue}>{num(tapeFat.pct)} %</Text>
                  </View>
                  <Text style={styles.note}>{tapeFatNote(profile.sex)}</Text>
                  <Text style={styles.note}>{t('US Navy circumference formula.')}</Text>
                </>
              ) : tapeFat.kind === 'missing' ? (
                <Text style={styles.note}>{t('For a body fat estimate, also fill in: {sites}.', { sites: tapeNames(tapeFat.sites) })}</Text>
              ) : tapeFat.kind === 'needs_profile' ? (
                <Text style={styles.note}>{t('For a body fat estimate with the tape we need your sex and height in your profile: the formula depends on them.')}</Text>
              ) : (
                <Text style={styles.note}>{t('With these measurements the formula does not give an estimate.')}</Text>
              )}
            </View>
          )}
          {basicsNote ? <Text style={[styles.note, styles.after]}>{basicsNote}</Text> : null}

          <View style={styles.dateRow}>
            <FRow title={t('Date')} value={formatDate(date)} onPress={() => setPicking(true)} last />
          </View>
          {Object.keys(last).length > 0 && !focus && (
            <Text style={styles.note}>{t('Your last measurements: {date}.', { date: shortDate(Object.values(last).reduce((a, r) => (r.fecha > a ? r.fecha : a), '')) })}</Text>
          )}
        </ScrollView>
      </View>

      <KeyboardFooter>
        <View style={measureStyles.footer}>
          <FineButton label={t('Save')} onPress={save} disabled={!count || !!invalid.length || saving} />
        </View>
      </KeyboardFooter>

      <DateTimeSheet mode={picking ? 'date' : null} value={date} onChange={onPickerChange} onClose={() => setPicking(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  tabs: { paddingHorizontal: 20, marginBottom: 6 },
  // La figura fija a la izquierda y la lista a la derecha
  main: { flex: 1, flexDirection: 'row', paddingLeft: 12, paddingRight: 20, gap: 10 },
  figure: { width: '38%', maxWidth: 260, minWidth: 120 },
  list: { flex: 1 },
  listContent: { paddingBottom: 20 },
  lead: { ...fine.note, marginTop: 4, marginBottom: 6 },
  // Del ancho de las casillas (inputWrap) y alineado con ellas
  unitSwitch: { alignSelf: 'flex-end', width: 84, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, minHeight: 54, borderBottomWidth: 1, borderBottomColor: FINE.line },
  lastRow: { borderBottomWidth: 0 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14 },
  hint: { ...ff('regular'), fontSize: 12, lineHeight: 16, color: FINE.jade, marginTop: 2 },
  // La casilla de cada medida: casi transparente con borde fino; la del sitio elegido, en jade
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    // Sin ancho fijo para la unidad: con la letra del sistema grande, «cm» y «mm» caían partidos en dos líneas («c» / «m»,
    // «m» / «m»; fundador, 2026-11-17). La casilla crece lo justo y no encoge
    minWidth: 92,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: FINE.line,
    backgroundColor: FINE.tile,
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  inputOn: { borderColor: FINE.jade },
  // Lo que no cuadra: el coral suave de los errores (formStyles.error), sin rojo
  inputBad: { borderColor: '#E9A48F' },
  // Ancho fijo: en la web un campo de texto sin ancho ocupa de más
  input: { ...ff('regular'), width: 48, color: FINE.ivory, fontSize: 16, paddingVertical: 7, textAlign: 'right', fontVariant: ['tabular-nums'] },
  unit: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, minWidth: 22, flexShrink: 0 },
  after: { marginTop: 8 },
  result: { marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: FINE.rule, gap: 4 },
  resultRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  resultValue: { ...fine.num, fontSize: 26, lineHeight: 32 },
  note: { ...fine.note, marginTop: 2 },
  dateRow: { marginTop: 14, borderTopWidth: 1, borderTopColor: FINE.rule },
});
