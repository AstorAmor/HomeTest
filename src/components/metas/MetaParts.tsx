// Piezas de las pantallas de metas (src/app/metas*.tsx y la sección de Hoy). Desde el 2026-11-16, en el
// lenguaje fino del prototipo de las 4 pestañas (borradores/app-estructura/prototipo; ESPECIFICACION.md §7):
// - Cada meta en su área: el nombre, una línea apagada («8.000 al día · 2 de 7 días · del reloj») y sus 7 días
//   en círculos (L a D). Lo cumplido, lleno del color del área; hoy, con un aro; lo que aún no cuenta, apagado.
//   En las de cantidad, la cifra de cada día debajo.
// - Un toque en un día de un sí / no lo marca o lo desmarca; en las de cantidad (y en lo que llega solo) se abre
//   una hoja con «− número +», la unidad fuera y «Guardar».
// - Botones en píldora esmeralda, opciones en chips con borde, filas con una línea fina (sin tarjetas).
import { ReactNode, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Easing, Platform, Modal, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import type { RingColors } from '@/components/GlowRing';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Confetti } from '@/components/Confetti';
import { Pill } from '@/components/fine/Fine';
import { FineStepper } from './FineStepper';
import { dateLocale, t } from '@/i18n';
import {
  autoLabel,
  bounds,
  chipNum,
  dateOfKey,
  evalMeta,
  fmtMeta,
  fromLabel,
  metaText,
  progressText,
  r2,
  stepDay,
  stepTarget,
  unitWord,
  valueText,
  weekdayLetter,
  type Area,
  type Meta,
  type MetaEval,
  type WeekPart,
} from '@/logic/metas';
import { FINE, ff, fine } from '@/theme/fine';

// Identidad de cada área (rediseño «Emerald Luxury», 2026-11-15): Ejercicio turquesa, Alimentación jade y
// Hábitos champán. En claro, tonos más hondos para que el nombre se lea sobre el crema. El anillo va de
// un tono hondo a uno luminoso en la punta.
export const AREA_COLOR: Record<Area, string> = Colors.isLight
  ? { ej: '#217A83', al: '#287A5A', ha: '#8C6C33' }
  : { ej: '#5CC7C9', al: '#83D6B4', ha: '#D8B978' };
export const AREA_RING: Record<Area, RingColors> = Colors.isLight
  ? { ej: ['#1A5F68', '#2E959E', '#73C6C4'], al: ['#1D654A', '#2E9A72', '#7BC9A5'], ha: ['#7A5B26', '#AE8843', '#D9BA79'] }
  : { ej: ['#2A7F8C', '#4FC0C6', '#A6EAE3'], al: ['#2A7F5F', '#5DC197', '#B2EBD0'], ha: ['#93713A', '#CFAE6C', '#F3E0AE'] };
export const AREA_ICON: Record<Area, string> = { ej: 'walk-outline', al: 'nutrition-outline', ha: 'time-outline' };
export const pct = (f: number) => `${Math.round(f * 100)}%`;

const DARK = '#061A16'; // la letra sobre un día cumplido (lleno del color del área)
const lowerFirst = (s: string) => (/^[A-ZÁÉÍÓÚ][a-záéíóúñ ]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

// La pantalla: cabecera con «atrás» y el contenido con scroll (`overlay`: encima de todo, p. ej. el confeti)
export function MetasScreenFrame({ title, children, overlay }: { title: string; children: ReactNode; overlay?: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={title} showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {overlay}
    </SafeAreaView>
  );
}

// ===== Llegar al 100 % (fundador, 2026-11-05) =====
// Al marcar algo con lo que un área llega al 100 % de la semana: su cifra crece y vuelve (zoom y
// retroceso) y salta confeti; si con ella ya están las tres, algo más grande: más confeti, dorado, y
// «¡Los tres al 100 %!». Solo al marcar tú (no al abrir la pantalla ya al 100 %). Al volver a Hoy, el
// % de esa área da también su saltito (popPending).
const useNativeDriver = Platform.OS !== 'web';
const popPending = new Set<Area>();
export const takePop = (a: Area) => popPending.delete(a);

export function usePop() {
  const scale = useRef(new Animated.Value(1)).current;
  const pop = (big = false) => {
    scale.stopAnimation();
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, { toValue: big ? 1.38 : 1.24, duration: 240, easing: Easing.out(Easing.back(2)), useNativeDriver }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 70, useNativeDriver }),
    ]).start();
  };
  return { scale, pop };
}

export type Party = { kind: 'area' | 'all'; n: number } | null;

// La cifra grande de un área («39 %», Inter ligera como en el prototipo), que celebra. `armed`: lo acabas de marcar tú.
export function CelebratePct({ area, score, allDone, armed, onParty }: { area: Area; score: number | null; allDone: boolean; armed: { current: boolean }; onParty: (kind: 'area' | 'all') => void }) {
  const { scale, pop } = usePop();
  const prev = useRef(score);
  useEffect(() => {
    const was = prev.current ?? 0;
    prev.current = score;
    if (!armed.current) return;
    armed.current = false;
    if (was < 1 && (score ?? 0) >= 1) {
      pop(allDone);
      popPending.add(area);
      onParty(allDone ? 'all' : 'area');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, allDone]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Text style={styles.bigNum} accessibilityLabel={score == null ? t('No data') : pct(score)}>
        {score == null ? '—' : Math.round(score * 100)}
        {score != null && <Text style={styles.bigPct}> %</Text>}
      </Text>
    </Animated.View>
  );
}

const GOLDS = [Colors.gold, '#E3CFA3', Colors.amber, Colors.ok, Colors.sky, Colors.violet];

// Encima de la pantalla: el confeti y, con las tres, el mensaje
export function PartyOverlay({ party }: { party: Party }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (party?.kind !== 'all') return;
    fade.setValue(0);
    Animated.sequence([
      Animated.spring(fade, { toValue: 1, friction: 5, tension: 60, useNativeDriver }),
      Animated.delay(2600),
      Animated.timing(fade, { toValue: 0, duration: 500, useNativeDriver }),
    ]).start();
  }, [party, fade]);
  if (!party) return null;
  const all = party.kind === 'all';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Confetti key={party.n} count={all ? 170 : 70} duration={all ? 4200 : 2600} colors={all ? GOLDS : undefined} />
      {all && (
        <Animated.View style={[styles.partyBox, { opacity: fade, transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
          <Ionicons name="trophy-outline" size={30} color={FINE.gold} />
          <Text style={styles.partyTitle}>{t('All three at 100%!')}</Text>
          <Text style={styles.partyText}>{t('Exercise, nutrition and habits: everything done so far this week.')}</Text>
        </Animated.View>
      )}
    </View>
  );
}

// «A mano · Reloj»: un interruptor con las dos palabras a los lados
export function SourceSwitch({ m, onToggle }: { m: Meta; onToggle: () => void }) {
  if (!m.auto) return null;
  const on = m.autoOn;
  return (
    <TouchableOpacity
      style={styles.sw}
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={t('{a} or by hand', { a: autoLabel(m.auto) })}
      hitSlop={6}
    >
      <Text style={[styles.swLabel, !on && styles.swLabelOn]}>{t('By hand')}</Text>
      <View style={[styles.swTrack, on && styles.swTrackOn]}>
        <View style={[styles.swKnob, on && styles.swKnobOn]} />
      </View>
      <Text style={[styles.swLabel, on && styles.swLabelOn]}>{autoLabel(m.auto)}</Text>
    </TouchableOpacity>
  );
}

const fullDay = (day: string, today: string | null) => {
  if (day === today) return t('Today');
  const s = dateOfKey(day).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// El nombre corto de una meta: «Pasos», «Fruta», o el que le pusiste
export const metaName = (m: Meta) => (m.custom ? m.custom.name : t(m.def!.short));

// La meta sin su nombre, para la línea de debajo: «7.500 pasos al día», «Cada día», «3 días a la semana»
export function targetLine(m: Meta): string {
  if (m.kind === 'yesno') {
    if (m.per === 'day') return t('Every day');
    if (m.def?.sessions) return metaText(m);
    return t(m.tgt === 1 ? '{n} day a week' : '{n} days a week', { n: m.tgt });
  }
  const u = unitWord(m, m.tgt);
  const q = `${fmtMeta(m, m.tgt)}${u ? ` ${u}` : ''}`;
  if (m.custom) return t(m.per === 'day' ? '{q} a day' : '{q} a week', { q });
  // «Dormir 7 h o más» lleva el nombre dentro: debajo de «Dormir», solo «7 h o más»
  if (m.def?.phrase) return t('{q} or more', { q });
  return metaText(m);
}

// Cómo vas. En un límite a la semana, solo lo que llevas (el límite ya va en la frase de la meta)
export function progressLine(m: Meta, e: MetaEval): string {
  if (m.limit && m.per === 'week' && (e.started || e.current)) {
    const sd = r2(e.sum / m.f);
    return t(e.current ? '{sum} {unit} this week' : '{sum} {unit} that week', { sum: fmtMeta(m, sd), unit: unitWord(m, sd) }).replace(/\s{2,}/g, ' ');
  }
  return progressText(m, e);
}

export interface MetaWeekProps {
  m: Meta;
  vals: (number | null)[]; // los 7 días de la semana
  autoVals?: (number | null)[]; // lo que llegó solo (reloj, Entrenamientos, check-in) esos días
  fixed?: boolean[]; // días corregidos a mano
  days: string[];
  week: WeekPart; // qué días cuentan (hoy, en la semana en curso)
  known?: boolean; // ya tenía datos antes de esta semana
  color: string;
  onSet: (day: string, value: number | null) => void;
}

// Los 7 días de una meta (prototipo, `dots()`): círculos de 38 con su letra. Un sí / no a mano se marca o se
// quita con un toque; en las de cantidad, y en lo que llega solo, se abre la hoja del día. Los que no cuentan
// (antes de empezar, o aún por llegar) salen apagados y no se tocan.
export function MetaWeek({ m, vals, autoVals, fixed, days, week, known, color, onSet }: MetaWeekProps) {
  const [pick, setPick] = useState<number | null>(null);
  const e = evalMeta(m, vals, week, known);
  const T = week.current ? week.to : -1;
  const today = T >= 0 ? days[T] : null;
  const manual = !m.autoOn;
  const amount = m.kind === 'amount';

  const tapDay = (i: number) => {
    if (e.st[i] === 'off') return;
    if (m.kind === 'yesno' && manual) onSet(days[i], vals[i] === 1 ? (i === T ? null : 0) : 1);
    else setPick(i);
  };

  return (
    <>
      <View style={styles.wd}>
        {vals.map((v, i) => {
          const s = e.st[i];
          const off = s === 'off';
          const on = s === 'ok' || s === 'mark';
          // La cifra de cada día, con un decimal como mucho (7,25 h → 7,3): cabe debajo del círculo
          const fig = amount && !off && v != null && (v > 0 || m.per === 'day') ? chipNum(m, Math.round((v / m.f) * 10) / 10) : '';
          return (
            <View key={days[i]} style={styles.dc}>
              <View style={styles.ddBox}>
                {i === T && <View style={styles.ring} pointerEvents="none" />}
                <TouchableOpacity
                  style={[styles.dd, on && { backgroundColor: color, borderColor: color }, off && styles.ddOff]}
                  onPress={() => tapDay(i)}
                  disabled={off}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: off, selected: on }}
                  accessibilityLabel={`${fullDay(days[i], today)}: ${valueText(m, v)}`}
                >
                  <Text style={[styles.ddText, on && styles.ddTextOn]}>{weekdayLetter(days[i])}</Text>
                </TouchableOpacity>
              </View>
              {amount && (
                <Text style={styles.fig} numberOfLines={1}>
                  {fig}
                </Text>
              )}
            </View>
          );
        })}
      </View>
      {pick != null && (
        <DaySheet
          key={days[pick]}
          m={m}
          title={fullDay(days[pick], today)}
          value={vals[pick]}
          autoValue={autoVals?.[pick] ?? null}
          fixed={!!fixed?.[pick]}
          color={color}
          onSave={(v) => onSet(days[pick], v)}
          onClose={() => setPick(null)}
        />
      )}
    </>
  );
}

// La hoja de un día (prototipo, `daySheet()`): el nombre, el día y tu meta; «− número +» con la unidad fuera
// (o «Hecha / No hecha» en un sí / no que llega solo) y «Guardar». Con el reloj encendido también se puede
// corregir un día a mano (fundador, 2026-11-05); lo corregido manda y se puede volver a lo que llegó solo.
function DaySheet({
  m,
  title,
  value,
  autoValue,
  fixed,
  color,
  onSave,
  onClose,
}: {
  m: Meta;
  title: string;
  value: number | null;
  autoValue: number | null;
  fixed: boolean;
  color: string;
  onSave: (v: number | null) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const yesno = m.kind === 'yesno';
  const [draft, setDraft] = useState<number | null>(value ?? (yesno ? null : 0));
  const x = r2((draft ?? 0) / m.f);
  const save = () => {
    if (draft != null) onSave(draft);
    onClose();
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} onPress={() => undefined}>
          <Text style={styles.sheetTitle}>{metaName(m)}</Text>
          <Text style={styles.sheetSub}>
            {title} · {t('Your target: {text}', { text: lowerFirst(metaText(m)) })}
          </Text>
          {m.autoOn && m.auto && (
            <View style={styles.autoLine}>
              <Text style={[styles.sheetNote, { flex: 1 }]}>
                {fixed
                  ? t('Changed by hand ({value} {from}).', { from: fromLabel(m.auto), value: valueText(m, autoValue) })
                  : t('{value}, {from}. You can change it by hand.', { value: valueText(m, value), from: fromLabel(m.auto) })}
              </Text>
              {fixed && (
                <TouchableOpacity
                  onPress={() => {
                    onSave(null);
                    onClose();
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Text style={fine.link}>{t('Undo')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {yesno ? (
            <View style={styles.yesNo}>
              {[1, 0].map((v) => {
                const on = draft === v;
                return (
                  <TouchableOpacity
                    key={v}
                    style={[styles.chip, on && { borderColor: color, backgroundColor: 'rgba(131,214,180,0.08)' }]}
                    onPress={() => setDraft(v)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{valueText(m, v)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <FineStepper
              value={fmtMeta(m, x)}
              unit={unitWord(m, x)}
              onMinus={() => setDraft((d) => stepDay(m, d, -1))}
              onPlus={() => setDraft((d) => stepDay(m, d, 1))}
              canMinus={(draft ?? 0) > 0}
              canPlus={(draft ?? 0) < r2(m.max * m.f)}
              style={styles.sheetStepper}
            />
          )}
          <View style={styles.acts}>
            <Pill label={t('Save')} onPress={save} />
            <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityRole="button">
              <Text style={fine.link}>{t('Cancel')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Una meta en su área (prototipo, `.mrow`): el nombre (toca para ver su evolución), la línea apagada y los 7 días
export function MetaRow({ last, ...p }: MetaWeekProps & { last?: boolean }) {
  const router = useRouter();
  const { m } = p;
  const e = evalMeta(m, p.vals, p.week, p.known);
  const sub = [targetLine(m), progressLine(m, e), m.autoOn && m.auto ? fromLabel(m.auto) : null].filter(Boolean).join(' · ');
  return (
    <View style={[styles.mrow, last && { borderBottomWidth: 0 }]}>
      <TouchableOpacity
        style={styles.mrowHead}
        onPress={() => router.push({ pathname: '/metas-info', params: { id: m.id } })}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        <Text style={fine.rowTitle}>{metaName(m)}</Text>
        <Text style={fine.rowSub}>{sub}</Text>
      </TouchableOpacity>
      <MetaWeek {...p} />
    </View>
  );
}

// Ajustar: «− 7.500 + pasos al día», centrado (fundador, 2026-11-06: estaba a la izquierda)
export function TargetStepper({ m, onChange }: { m: Meta; onChange: (tgt: number) => void }) {
  const per = t(m.per === 'day' ? 'a day' : 'a week');
  const [lo, hi] = bounds(m);
  return (
    <FineStepper
      value={fmtMeta(m, m.tgt)}
      unit={`${unitWord(m, m.tgt)} ${per}`.trim()}
      onMinus={() => onChange(stepTarget(m, -1))}
      onPlus={() => onChange(stepTarget(m, 1))}
      canMinus={m.tgt > lo}
      canPlus={m.tgt < hi}
    />
  );
}

// Un − # + sencillo (para la meta tuya y los días a la semana)
export function SmallStepper({ value, onChange, min = 1, max = 999, unit }: { value: number; onChange: (v: number) => void; min?: number; max?: number; unit?: string }) {
  return (
    <FineStepper
      small
      value={String(value)}
      unit={unit}
      onMinus={() => onChange(Math.max(min, value - 1))}
      onPlus={() => onChange(Math.min(max, value + 1))}
      canMinus={value > min}
      canPlus={value < max}
    />
  );
}

// Opciones (Día / Semana, unidades, áreas…): chips con borde; el elegido, en marfil con borde jade
export function Segmented<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.seg}>
      {options.map(([k, label]) => {
        const on = value === k;
        return (
          <TouchableOpacity
            key={k}
            style={[styles.chip, on && styles.chipOn]}
            onPress={() => onChange(k)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Un círculo con borde fino; marcado, jade con la marca oscura (prototipo, `.mark`)
export function Checkbox({ on, disabled, onPress, label }: { on: boolean; disabled?: boolean; onPress: () => void; label: string }) {
  return (
    <TouchableOpacity
      style={[styles.box, on && styles.boxOn, disabled && { opacity: 0.35 }]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on, disabled }}
      accessibilityLabel={label}
      hitSlop={8}
    >
      {on && <Ionicons name="checkmark" size={15} color={DARK} />}
    </TouchableOpacity>
  );
}

// Estilos compartidos de las pantallas de metas, en el lenguaje fino: sin tarjetas, filas con línea fina,
// cabeceras pequeñas en mayúsculas, píldora esmeralda y enlaces en jade
export const metaStyles = StyleSheet.create({
  card: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: FINE.line },
  cardList: { marginBottom: 4 },
  sec: { ...fine.secTitle, marginTop: 28, marginBottom: 6 },
  sub: { ...ff('regular'), color: FINE.mute, fontSize: 13.5, lineHeight: 19, marginBottom: 12 },
  h2: { ...ff('medium'), color: FINE.ivory, fontSize: 22, lineHeight: 28, marginTop: 4 },
  meta: { ...fine.note },
  p: { ...ff('regular'), color: '#CFD6CF', fontSize: 14, lineHeight: 20 },
  label: { ...fine.secTitle, marginTop: 24, marginBottom: 10 },
  btn: { ...fine.pill, alignSelf: 'center', marginTop: 24, minHeight: 44, paddingHorizontal: 22 },
  btnText: { ...fine.pillText, fontSize: 14 },
  btnSoft: { alignSelf: 'center', paddingVertical: 10, marginTop: 10, minHeight: 36, justifyContent: 'center' },
  btnSoftText: { ...fine.link, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, minHeight: 50, borderBottomWidth: 1, borderBottomColor: FINE.line },
  rowT: { ...fine.rowTitle },
  rowD: { ...fine.rowSub },
  tag: {
    ...ff('regular'),
    color: FINE.jade,
    fontSize: 11,
    borderWidth: 1,
    borderColor: FINE.jadeLine,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 1,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    marginTop: 5,
  },
  link: { ...fine.link, fontSize: 14 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  bigNum: { ...ff('light'), color: FINE.ivory, fontSize: 44, lineHeight: 50, fontVariant: ['tabular-nums'] },
  bigPct: { ...ff('light'), fontSize: 18 },
  partyBox: {
    position: 'absolute',
    top: '32%',
    left: 32,
    right: 32,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: '#0A231D',
    borderWidth: 1,
    borderColor: FINE.goldLine,
  },
  partyTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 21, textAlign: 'center' },
  partyText: { ...ff('regular'), color: FINE.mute, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  sw: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swLabel: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  swLabelOn: { ...ff('medium'), color: FINE.ivory },
  swTrack: { width: 38, height: 22, borderRadius: 11, backgroundColor: 'rgba(240,239,230,0.14)', padding: 3, justifyContent: 'center' },
  swTrackOn: { backgroundColor: FINE.emerald },
  swKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: FINE.ivory },
  swKnobOn: { alignSelf: 'flex-end' },
  // Una meta en su área (prototipo, `.mrow`)
  mrow: { paddingTop: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: FINE.line },
  mrowHead: { minHeight: 44, justifyContent: 'center' },
  // Los 7 días (prototipo, `.wd`, `.dd`, `.dc`)
  wd: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  dc: { flex: 1, alignItems: 'center', gap: 3 },
  ddBox: { width: 38, height: 38 },
  dd: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(240,239,230,0.22)', alignItems: 'center', justifyContent: 'center' },
  ddOff: { opacity: 0.35 },
  // Hoy: un aro marfil separado del círculo por un hueco del color del fondo
  ring: { position: 'absolute', top: -3.5, left: -3.5, width: 45, height: 45, borderRadius: 22.5, borderWidth: 1.5, borderColor: FINE.ivory },
  ddText: { ...ff('regular'), color: FINE.mute, fontSize: 12 },
  ddTextOn: { ...ff('semibold'), color: DARK },
  fig: { ...ff('regular'), color: FINE.mute, fontSize: 10.5, minHeight: 13, lineHeight: 13, fontVariant: ['tabular-nums'] },
  // La hoja de un día
  backdrop: { flex: 1, backgroundColor: 'rgba(2,10,8,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0A231D', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(240,239,230,0.14)', paddingHorizontal: 20, paddingTop: 20 },
  sheetTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 19, lineHeight: 24 },
  sheetSub: { ...ff('regular'), color: FINE.mute, fontSize: 14, lineHeight: 20, marginTop: 6 },
  sheetNote: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 18 },
  sheetStepper: { marginTop: 18 },
  autoLine: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  yesNo: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 18 },
  acts: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 22 },
  // Chips con borde (prototipo, `.chipsw`)
  seg: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { minHeight: 38, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: FINE.line, justifyContent: 'center' },
  chipOn: { borderColor: FINE.jade, backgroundColor: 'rgba(131,214,180,0.08)' },
  chipText: { ...ff('regular'), color: FINE.mute, fontSize: 13 },
  chipTextOn: { color: FINE.ivory },
  box: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(240,239,230,0.3)', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: FINE.jade, borderColor: FINE.jade },
});
