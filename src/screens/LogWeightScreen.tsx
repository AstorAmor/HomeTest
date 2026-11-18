import { dateLocale, num, t } from '@/i18n';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, TextInput, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { DateTimeSheet } from '@/components/DateTimeSheet';
import { Colors } from '@/constants/colors';
import { ScreenHeader } from '@/components/ScreenHeader';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { KeyboardFooter } from '@/components/KeyboardFooter';
import { FineTabs } from '@/components/MeasureTabs';
import { FRow } from '@/components/fine/Fine';
import { CloseButton, FineButton, measureStyles } from '@/components/fine/FineMeasure';
import { FineNumber, useNumbersReady } from '@/components/fine/FineNumber';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { profileRepository } from '@/data/profileRepository';
import { loadBodyBasics } from '@/data/bodyBasics';
import { loadMeasureReadings, sampleMeasureReadings } from '@/data/measurementsRepository';
import { BodyComp, bodyCompFor, removeWeighIn, saveWeighIn, weightRepository } from '@/data/weightRepository';
import { BODY_COMP, BodyCompKind, parseComp, weighAdvice } from '@/logic/weight';
import { summarize } from '@/logic/bodyMeasures';
import { fatSplit, measureFatCandidates, pickBodyFat, type BodyFatSource } from '@/logic/bodyComposition';
import { shortDay } from '@/screens/measureFormat';
import { offerPhoneReminders } from '@/data/phoneReminders';
import { FINE, ff, fine } from '@/theme/fine';

// Apuntar el peso, las medidas y la composición corporal de una vez. Con el aviso de que no hace falta pesarse a
// diario. Desde el 2026-11-16, como en el prototipo: la cifra grande y ligera con «− +» (de 100 en 100 g; tocarla
// abre el teclado para escribirla), la fecha y la hora en filas con línea fina y un solo botón de Guardar abajo (el
// fundador prefiere este estilo a la rueda). La cifra es FineNumber, el mismo «− +» con teclado que la glucosa y la
// tensión (2026-11-16): dejándolo pulsado, al rato va de 0,5 en 0,5.
// Desde el 2026-11-18 (fundador: «Añades peso y luego es cuando te aparece todo, pero me gustaría que puedas añadir
// de primeras peso, composición y medidas, y que la composición te sugiera la de las medidas o introducir a mano»):
// debajo del peso, «Medidas» abre la figura para apuntarlas (LogMeasurementsScreen) y, al volver, se recalcula lo de
// abajo; y «Composición corporal» ya no va plegada, con dos pestañas: «Con tus medidas» (la grasa estimada con la
// cinta o los pliegues, pasada a kilos con el peso de arriba, o qué falta para calcularla) y «De tu báscula» (las
// cuatro casillas: grasa, agua, músculo y hueso). La estimación no se guarda como si fuera de la báscula: con «Con
// tus medidas» la pesada se guarda sin composición y la ficha la calcula con las medidas (pickBodyFat). Si la pesada
// ya tenía composición de la báscula, se avisa de que al guardar se quita.

const MIN = 30;
const MAX = 250;
const formatDate = (date: Date) => date.toLocaleDateString(dateLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
const formatTime = (date: Date) => date.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });
const clampKg = (v: number) => Math.round(Math.max(MIN, Math.min(MAX, v)) * 10) / 10;

export const LogWeightScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [dateTime, setDateTime] = useState(new Date());
  const [kg, setKg] = useState(70);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [comp, setComp] = useState<Record<BodyCompKind, string>>({ body_fat: '', body_water: '', muscle_mass: '', bone_mass: '' });
  // De dónde sale la composición: la estimada con las medidas o la que se copia de la báscula
  const [mode, setMode] = useState<'measures' | 'scale'>('scale');
  const modeChosen = useRef(false); // la pestaña la eligió la persona (o la pesada ya tenía báscula): no se cambia sola
  const [hadScale, setHadScale] = useState(false); // la pesada que se edita tenía composición de la báscula
  const [recent, setRecent] = useState<{ inLastWeek: number; daysSince: number | null }>({ inLastWeek: 0, daysSince: null });
  const [saving, setSaving] = useState(false);
  // Las medidas: la última vez que se apuntaron, si son las de ejemplo, el sexo del perfil (qué medidas pide la
  // fórmula) y la grasa que sale con ellas (la más reciente de pliegues o cinta)
  const [measures, setMeasures] = useState<{
    lastDate: string | null;
    sample: boolean;
    sex?: string;
    fat: { pct: number; fecha: string; source: BodyFatSource; sample: boolean } | null;
  } | null>(null);
  const numbers = useNumbersReady();
  const value = kg;
  const chooseMode = (m: 'measures' | 'scale') => {
    modeChosen.current = true;
    setMode(m);
  };

  const setFrom = (v: number) => setKg(clampKg(v));
  // La fecha y la hora se eligen con el teclado cerrado
  const openPicker = (mode: 'date' | 'time') => {
    Keyboard.dismiss();
    setPickerMode(mode);
  };

  useEffect(() => {
    (async () => {
      const entries = await weightRepository.getAll();
      const existing = id ? entries.find((e) => e.id === id) : undefined;
      if (existing) {
        setFrom(existing.valor);
        setDateTime(new Date(existing.fecha));
        const c = await bodyCompFor(existing.id);
        setComp({
          body_fat: c.body_fat != null ? num(c.body_fat) : '',
          body_water: c.body_water != null ? num(c.body_water) : '',
          muscle_mass: c.muscle_mass != null ? num(c.muscle_mass) : '',
          bone_mass: c.bone_mass != null ? num(c.bone_mass) : '',
        });
        if (Object.keys(c).length > 0) {
          setHadScale(true);
          modeChosen.current = true;
          setMode('scale');
        }
      } else {
        const last = [...entries].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
        if (last) setFrom(last.valor);
        else {
          const p = await profileRepository.get().catch(() => null);
          if (p?.weightKg) setFrom(p.weightKg);
        }
        const a = weighAdvice(entries);
        setRecent({ inLastWeek: a.inLastWeek, daysSince: a.daysSince });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Las medidas, al abrir y al volver de apuntarlas en la figura
  useReloadOnFocus(
    useCallback(() => {
      (async () => {
        const [readings, basics] = await Promise.all([loadMeasureReadings(), loadBodyBasics()]);
        // Sin medidas propias, las de ejemplo (demo y cuentas de prueba), como en la ficha del peso
        const own = summarize(readings);
        const sample = own.length > 0 ? null : sampleMeasureReadings();
        const shown = sample ? summarize(sample) : own;
        const lastDate = shown.reduce<string | null>((a, s) => (!a || s.latest.fecha > a ? s.latest.fecha : a), null);
        const pick = pickBodyFat(measureFatCandidates(sample ?? readings, basics));
        // De ejemplo también si la estimación sale con la persona o la altura de ejemplo de la demo
        const sampleBasics = basics.samplePerson || (pick?.source === 'tape' && basics.sampleHeight);
        setMeasures({
          lastDate,
          sample: !!sample,
          sex: basics.sex,
          fat: pick ? { pct: pick.pct, fecha: pick.fecha, source: pick.source, sample: !!sample || sampleBasics } : null,
        });
        // Con una estimación y sin haber elegido pestaña, se abre en «Con tus medidas»
        if (pick && !modeChosen.current) setMode('measures');
      })().catch(() => undefined);
    }, []),
  );

  const onPickerChange = (_e: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setPickerMode(null);
    if (!selected) return;
    setDateTime((prev) => {
      const next = new Date(prev);
      if (pickerMode === 'date') next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      else if (pickerMode === 'time') next.setHours(selected.getHours(), selected.getMinutes());
      return next;
    });
  };

  // Solo cuenta lo de la báscula con su pestaña abierta: con «Con tus medidas» la pesada va sin composición
  const parsed: BodyComp = {};
  const invalid: BodyCompKind[] = [];
  if (mode === 'scale') {
    for (const b of BODY_COMP) {
      const raw = comp[b.kind];
      if (!raw.trim()) continue;
      const v = parseComp(b.kind, raw);
      if (v === null) invalid.push(b.kind);
      else parsed[b.kind] = v;
    }
  }

  // La grasa de las medidas en kilos, con el peso de arriba
  const split = measures?.fat ? fatSplit(value, measures.fat.pct) : null;
  const fat = measures?.fat;
  const fatSource = !fat
    ? ''
    : fat.sample
      ? t('Sample data: log your first reading to see your own.')
      : fat.source === 'folds'
        ? t('Body fat estimated from your skinfolds on {date}.', { date: shortDay(fat.fecha) })
        : measures?.sex === 'female'
          ? t('Body fat estimated from your tape measure (neck, waist, hips and height) on {date}.', { date: shortDay(fat.fecha) })
          : t('Body fat estimated from your tape measure (neck, waist and height) on {date}.', { date: shortDay(fat.fecha) });
  // Sin estimación: con qué medidas sale (las fórmulas son por sexo)
  const fatHowTo =
    measures?.sex === 'male'
      ? t('With your neck, waist and height, or with your 3 skinfolds, we work it out.')
      : measures?.sex === 'female'
        ? t('With your neck, waist, hips and height, or with your 3 skinfolds, we work it out.')
        : t('To work it out from your measurements we need your sex in your profile.');
  const measuresSub = !measures?.lastDate
    ? t('Not logged yet')
    : measures.sample
      ? t('Sample data for now')
      : t('Last time: {date}', { date: shortDay(measures.lastDate) });

  const save = async () => {
    if (invalid.length || !numbers.ready) return;
    setSaving(true);
    try {
      await saveWeighIn({ id, kg: Math.round(value * 10) / 10, fecha: dateTime.toISOString(), comp: parsed });
      if (!id) void offerPhoneReminders('weigh_in');
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    await removeWeighIn(id);
    router.back();
  };

  // Ya se pesó hace poco: no se bloquea, solo se explica
  const soon = !id && recent.daysSince !== null && recent.daysSince < 7;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title={t('Weight')} right={<CloseButton onPress={() => router.back()} />} />

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.advice}>
          {soon
            ? recent.daysSince === 0
              ? t('You already weighed yourself today. Day-to-day changes are mostly water and food, not fat. Once a week is enough.')
              : recent.daysSince === 1
                ? t('You weighed yourself yesterday. Day-to-day changes are mostly water and food, not fat. Once a week is enough.')
                : t('You weighed yourself {n} days ago. Day-to-day changes are mostly water and food, not fat. Once a week is enough.', { n: recent.daysSince ?? 0 })
            : t('Once a week is enough: same day, in the morning, after the toilet and before breakfast, with little clothing. Weight swings 1–2 kg from one day to the next with food, salt, fluid retention or your cycle; the trend over several weeks is what counts.')}
        </Text>

        <FineNumber
          value={value}
          onChange={setFrom}
          min={MIN}
          max={MAX}
          decimals={1}
          step={0.1}
          fastStep={0.5}
          unit="kg"
          label={t('Weight')}
          onValidChange={numbers.watch('kg')}
          style={styles.number}
        />

        <View style={styles.rows}>
          <FRow title={t('Date')} value={formatDate(dateTime)} onPress={() => openPicker('date')} />
          <FRow title={t('Time')} value={formatTime(dateTime)} onPress={() => openPicker('time')} last />
        </View>

        {/* Medidas: abren la figura; al volver, la composición de abajo ya las lleva */}
        <Text style={styles.section}>{t('Body measurements')}</Text>
        <View style={styles.rows}>
          <FRow
            title={t('Tape measure and skinfolds')}
            sub={measures ? measuresSub : undefined}
            onPress={() => {
              Keyboard.dismiss();
              router.push('/log-measurements');
            }}
            last
          />
        </View>

        {/* Composición corporal: estimada con las medidas o copiada de la báscula */}
        <Text style={styles.section}>{t('Body composition')}</Text>
        <FineTabs
          value={mode}
          onChange={chooseMode}
          options={[
            { id: 'measures', label: t('From your measurements') },
            { id: 'scale', label: t('From your scale') },
          ]}
          style={styles.tabs}
        />
        {mode === 'measures' ? (
          <>
            {fat && split ? (
              <View style={styles.rows}>
                <FRow
                  title={t('Fat')}
                  right={<CompValue dot={FINE.gold} pct={split.fatPct} kg={split.fatKg} />}
                />
                <FRow title={t('Fat-free mass')} right={<CompValue dot={FINE.jade} pct={split.leanPct} kg={split.leanKg} />} last />
              </View>
            ) : null}
            <Text style={styles.compHint}>{fat && split ? fatSource : fatHowTo}</Text>
            {hadScale ? <Text style={styles.compHint}>{t('Saving removes what you copied from your scale for this weigh-in.')}</Text> : null}
          </>
        ) : (
          <>
            <Text style={styles.compHint}>
              {t('If your scale measures it, copy it here. It changes a lot with how hydrated you are, so compare it only between weigh-ins in the same conditions.')}
            </Text>
            <View style={styles.rows}>
              {BODY_COMP.map((b, i) => (
                <View key={b.kind} style={[fine.row, i === BODY_COMP.length - 1 && styles.noLine]}>
                  <Text style={[fine.rowTitle, styles.flex]}>{t(b.label)}</Text>
                  <View style={[styles.compInputWrap, invalid.includes(b.kind) && styles.compInvalid]}>
                    <TextInput
                      style={styles.compInput}
                      keyboardType="decimal-pad"
                      value={comp[b.kind]}
                      onChangeText={(v) => setComp((c) => ({ ...c, [b.kind]: v.replace(/[^\d.,]/g, '').slice(0, 5) }))}
                      placeholder="—"
                      placeholderTextColor={FINE.mute}
                      accessibilityLabel={t(b.label)}
                    />
                    <Text style={styles.compUnit}>{b.unit}</Text>
                  </View>
                </View>
              ))}
            </View>
            {invalid.length ? <Text style={styles.error}>{t('Check the values in red: they are outside the usual range.')}</Text> : null}
          </>
        )}
      </KeyboardAwareScrollView>

      <KeyboardFooter>
        <View style={measureStyles.footer}>
          <FineButton label={t('Save')} onPress={save} disabled={!!invalid.length || !numbers.ready || saving} />
          {id && (
            <TouchableOpacity style={styles.deleteButton} onPress={remove} hitSlop={8} accessibilityRole="button">
              <Ionicons name="trash-outline" size={15} color={FINE.mute} />
              <Text style={styles.deleteText}>{t('Delete entry')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardFooter>

      <DateTimeSheet mode={pickerMode} value={dateTime} onChange={onPickerChange} onClose={() => setPickerMode(null)} />
    </SafeAreaView>
  );
};

// Lo que pesa una parte: un punto de su color, el % y los kilos apagados
function CompValue({ dot, pct, kg }: { dot: string; pct: number; kg: number }) {
  return (
    <View style={styles.compValue}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={fine.rowValue}>{`${num(pct)} %`}</Text>
      <Text style={styles.compKg}>{`${num(kg.toFixed(1))} kg`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  // flexGrow: la ScrollView ocupa todo el hueco, así que tocar en cualquier sitio fuera de la cifra cierra el teclado
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  flex: { flex: 1 },
  advice: { ...fine.note, marginTop: 0 },
  number: { marginTop: 26, marginBottom: 18 },
  rows: { borderTopWidth: 1, borderTopColor: FINE.line },
  // «MEDIDAS», «COMPOSICIÓN CORPORAL»: el título pequeño de cada parte
  section: { ...fine.kicker, marginTop: 26, marginBottom: 8 },
  tabs: { marginBottom: 12 },
  compHint: { ...fine.note, marginTop: 10 },
  noLine: { borderBottomWidth: 0 },
  compValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  compKg: { ...ff('regular'), color: FINE.mute, fontSize: 13, minWidth: 56, textAlign: 'right', fontVariant: ['tabular-nums'] },
  compInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: FINE.line,
    backgroundColor: FINE.tile,
    borderRadius: 10,
    paddingHorizontal: 10,
    width: 132, // todas las casillas igual de anchas y alineadas, sea cual sea el nombre de la izquierda
  },
  // El texto dice «en rojo»: el borde de lo que no cuadra sigue en rojo
  compInvalid: { borderColor: Colors.danger },
  compInput: { ...ff('regular'), flex: 1, minWidth: 0, color: FINE.ivory, fontSize: 16, paddingVertical: 7, textAlign: 'right', fontVariant: ['tabular-nums'] },
  compUnit: { ...ff('regular'), color: FINE.mute, fontSize: 13, width: 22 },
  error: { ...ff('regular'), color: Colors.danger, fontSize: 12.5, marginTop: 8 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 4 },
  deleteText: { ...ff('regular'), color: FINE.mute, fontSize: 14 },
});
