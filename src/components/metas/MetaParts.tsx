// Piezas de las pantallas de metas (src/app/metas*.tsx y la sección de Hoy): el donut de cada área, el
// interruptor «A mano · Reloj», el «Hoy» de cada meta, los días de la semana y la ruedita, y el − # + de
// la meta.
import { ReactNode, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Easing, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { GlowRing, type RingColors } from '@/components/GlowRing';
import { WheelPicker } from '@/components/WheelPicker';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Confetti } from '@/components/Confetti';
import { dateLocale, t } from '@/i18n';
import {
  autoLabel,
  bounds,
  chipNum,
  clamp,
  dateOfKey,
  dayValues,
  evalMeta,
  fmtMeta,
  fromLabel,
  metaText,
  progressText,
  stepDay,
  stepTarget,
  targetValues,
  unitWord,
  valueText,
  weekdayLetter,
  type Area,
  type Meta,
  type WeekPart,
} from '@/logic/metas';

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
// Al marcar algo con lo que un área llega al 100 % de la semana: su donut crece y vuelve (zoom y
// retroceso) y salta confeti; si con ella ya están las tres, algo más grande: más confeti, dorado, y
// «¡Los tres al 100 %!». Solo al marcar tú (no al abrir la pantalla ya al 100 %). Al volver a Hoy, el
// donut de esa área da también su saltito (popPending).
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

// El donut grande de un área, que celebra. `armed`: lo acabas de marcar tú.
export function CelebrateRing({ area, score, allDone, armed, onParty, ...ring }: { area: Area; score: number | null; allDone: boolean; armed: { current: boolean }; onParty: (kind: 'area' | 'all') => void; size?: number; stroke?: number; sub?: string }) {
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
      <AreaRing area={area} score={score} {...ring} />
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
          <View style={styles.partyIcon}>
            <Ionicons name="trophy" size={34} color={Colors.gold} />
          </View>
          <Text style={styles.partyTitle}>{t('All three at 100%!')}</Text>
          <Text style={styles.partyText}>{t('Exercise, eating and habits: everything done so far this week.')}</Text>
        </Animated.View>
      )}
    </View>
  );
}

// El donut de un área: anillo fino con degradado y punto de luz (GlowRing) y la cifra en el centro, con el
// «%» más pequeño. En los anillos pequeños de las listas (< 48 px) no se pone cifra.
export function AreaRing({ area, score, size = 80, stroke = 5, sub }: { area: Area; score: number | null; size?: number; stroke?: number; sub?: string }) {
  const big = size > 90;
  return (
    <GlowRing progress={score ?? 0} colors={AREA_RING[area]} size={size} stroke={stroke}>
      {size >= 48 && (
        <Text style={[styles.ringPct, big && styles.ringPctBig]} accessibilityLabel={score == null ? t('No data') : pct(score)}>
          {score == null ? '—' : Math.round(score * 100)}
          {score != null && <Text style={[styles.ringPctSign, big && styles.ringPctSignBig]}>%</Text>}
        </Text>
      )}
      {sub ? <Text style={styles.ringSub}>{sub}</Text> : null}
    </GlowRing>
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
      <View style={[styles.swTrack, on && { backgroundColor: Colors.accent }]}>
        <View style={[styles.swKnob, on && styles.swKnobOn]} />
      </View>
      <Text style={[styles.swLabel, on && styles.swLabelOn]}>{autoLabel(m.auto)}</Text>
    </TouchableOpacity>
  );
}

// − # + con la unidad fuera; el número abre la ruedita
function Counter({ value, unit, onMinus, onPlus, onTap, small }: { value: string; unit: string; onMinus: () => void; onPlus: () => void; onTap: () => void; small?: boolean }) {
  return (
    <View style={styles.cnt}>
      <TouchableOpacity style={styles.cntBtn} onPress={onMinus} accessibilityLabel={t('Less')} hitSlop={4}>
        <Text style={styles.cntSign}>−</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.cntVal, small && { minWidth: 46 }]} onPress={onTap} accessibilityLabel={t('Choose with the wheel')}>
        <Text style={styles.cntValText}>{value}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cntBtn} onPress={onPlus} accessibilityLabel={t('More')} hitSlop={4}>
        <Text style={styles.cntSign}>+</Text>
      </TouchableOpacity>
      {unit ? <Text style={styles.cntUnit}>{unit}</Text> : null}
    </View>
  );
}

const fullDay = (day: string, today: string | null) => {
  if (day === today) return t('Today');
  const s = dateOfKey(day).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export interface MetaCardProps {
  m: Meta;
  vals: (number | null)[]; // los 7 días de la semana
  autoVals?: (number | null)[]; // lo que llegó solo (reloj, Entrenamientos, check-in) esos días
  fixed?: boolean[]; // días corregidos a mano
  days: string[];
  week: WeekPart; // qué días cuentan (hoy, en la semana en curso)
  known?: boolean; // ya tenía datos antes de esta semana
  color: string;
  onSet: (day: string, value: number | null) => void;
  onToggleSource: () => void;
}

// Una meta en su área: la frase, la (i), cómo vas, el interruptor, el «Hoy» y los días de la semana (al
// tocar uno, la ruedita; en un sí / no, se marca o se quita). Los que no cuentan (antes de empezar, o aún
// por llegar) salen apagados.
export function MetaCard({ m, vals, autoVals, fixed, days, week, known, color, onSet, onToggleSource }: MetaCardProps) {
  const router = useRouter();
  const [pick, setPick] = useState<number | null>(null);
  const e = evalMeta(m, vals, week, known);
  const T = week.current ? week.to : -1;
  const today = T >= 0 ? days[T] : null;
  const manual = !m.autoOn;

  const toggleYes = (i: number) => onSet(days[i], vals[i] === 1 ? (i === T ? null : 0) : 1);
  const tapDay = (i: number) => {
    if (e.st[i] === 'off') return;
    if (m.kind === 'yesno' && manual) {
      toggleYes(i);
      setPick(null);
    } else setPick(pick === i ? null : i);
  };

  let todayCtl: ReactNode;
  if (!manual) todayCtl = <Text style={styles.todayVal}>{valueText(m, vals[T])}</Text>;
  else if (m.kind === 'yesno') {
    const done = vals[T] === 1;
    todayCtl = (
      <TouchableOpacity style={[styles.check, done && { backgroundColor: color, borderColor: color }]} onPress={() => toggleYes(T)}>
        <Ionicons name="checkmark" size={15} color={done ? Colors.background : Colors.textSecondary} />
        <Text style={[styles.checkText, done && { color: Colors.background }]}>{done ? valueText(m, 1) : t('Mark')}</Text>
      </TouchableOpacity>
    );
  } else {
    const x = (vals[T] ?? 0) / m.f;
    todayCtl = (
      <Counter
        value={fmtMeta(m, x)}
        unit={unitWord(m, x)}
        onMinus={() => today && onSet(today, stepDay(m, vals[T], -1))}
        onPlus={() => today && onSet(today, stepDay(m, vals[T], 1))}
        onTap={() => setPick(pick === T ? null : T)}
        small
      />
    );
  }

  return (
    <View style={styles.item}>
      <View style={styles.itemHead}>
        <Text style={styles.itemTitle}>{metaText(m)}</Text>
        {!m.custom && (
          <TouchableOpacity onPress={() => router.push({ pathname: '/metas-info', params: { id: m.id } })} accessibilityLabel={t('Information')} hitSlop={8}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.row2}>
        <Text style={styles.prog}>{progressText(m, e)}</Text>
        <SourceSwitch m={m} onToggle={onToggleSource} />
      </View>
      {today && (
        <View style={[styles.row2, styles.todayRow]}>
          <Text style={styles.prog}>{t('Today')}</Text>
          {todayCtl}
        </View>
      )}
      <View style={styles.dots}>
        {vals.map((v, i) => {
          const s = e.st[i];
          const filled = s === 'ok' || s === 'mark';
          let inner = '';
          if (m.kind === 'yesno' || s === 'off') inner = '';
          else if (v != null && (v > 0 || m.per === 'day')) inner = chipNum(m, v / m.f);
          return (
            <TouchableOpacity
              key={days[i]}
              style={[styles.dotCol, s === 'off' && { opacity: 0.35 }]}
              onPress={() => tapDay(i)}
              disabled={s === 'off'}
              accessibilityLabel={fullDay(days[i], today)}
            >
              <Text style={[styles.dotDay, i === T && { color: Colors.textPrimary, fontWeight: '800' }]}>{weekdayLetter(days[i])}</Text>
              <View
                style={[
                  styles.dot,
                  m.kind === 'yesno' && { borderRadius: 14 },
                  filled && { backgroundColor: withAlpha(color, 0.9), borderColor: color },
                  s === 'no' && { borderColor: withAlpha(Colors.coral, 0.6), backgroundColor: withAlpha(Colors.coral, 0.1) },
                  s === 'pend' && { borderStyle: 'dashed' },
                  pick === i && { borderColor: Colors.textPrimary, borderWidth: 2 },
                ]}
              >
                {m.kind === 'yesno' && v === 1 && s !== 'off' ? (
                  <Ionicons name="checkmark" size={14} color={Colors.background} />
                ) : inner ? (
                  <Text style={[styles.dotText, filled && { color: Colors.background }]} numberOfLines={1}>
                    {inner}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      {pick != null && (
        <View style={styles.pick}>
          <View style={styles.pickHead}>
            <Text style={styles.pickTitle}>{fullDay(days[pick], today)}</Text>
            <TouchableOpacity onPress={() => setPick(null)} hitSlop={8}>
              <Text style={styles.link}>{t('Ready')}</Text>
            </TouchableOpacity>
          </View>
          {/* Con el reloj encendido también se puede corregir un día a mano (fundador, 2026-11-05); lo
              corregido manda y se puede volver a lo que llegó solo */}
          {!manual && (
            <View style={styles.autoLine}>
              <Text style={[styles.pickNote, { flex: 1 }]}>
                {fixed?.[pick]
                  ? t('Changed by hand ({value} {from}).', { from: fromLabel(m.auto!), value: valueText(m, autoVals?.[pick] ?? null) })
                  : t('{value}, {from}. You can change it by hand.', { value: valueText(m, vals[pick]), from: fromLabel(m.auto!) })}
              </Text>
              {fixed?.[pick] && (
                <TouchableOpacity onPress={() => onSet(days[pick], null)} hitSlop={8}>
                  <Text style={styles.link}>{t('Undo')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {m.kind === 'yesno' ? (
            <View style={styles.yesNo}>
              {[1, 0].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.check, vals[pick] === v && { backgroundColor: color, borderColor: color }]}
                  onPress={() => onSet(days[pick], v)}
                >
                  <Text style={[styles.checkText, vals[pick] === v && { color: Colors.background }]}>{valueText(m, v)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <DayWheel m={m} value={vals[pick]} onChange={(v) => onSet(days[pick], v)} />
          )}
        </View>
      )}
    </View>
  );
}

function DayWheel({ m, value, onChange }: { m: Meta; value: number | null; onChange: (v: number) => void }) {
  const opts = dayValues(m);
  const cur = clamp(Math.round((value ?? 0) / m.f / m.step), 0, opts.length - 1);
  return (
    <View style={styles.wheelRow}>
      <WheelPicker items={opts.map((x) => fmtMeta(m, x))} selectedIndex={cur} onChange={(i) => onChange(Math.round(opts[i] * m.f * 100) / 100)} width={110} itemHeight={36} visible={3} fadeColor={Colors.backgroundElevated} />
      <Text style={styles.wheelUnit}>{unitWord(m, opts[cur])}</Text>
    </View>
  );
}

// Ajustar: − # + y la unidad fuera («− 7.500 + pasos al día»); tocar el número abre la ruedita
export function TargetStepper({ m, onChange }: { m: Meta; onChange: (tgt: number) => void }) {
  const [open, setOpen] = useState(false);
  const per = t(m.per === 'day' ? 'a day' : 'a week');
  const vals = targetValues(m);
  const lo = bounds(m)[0];
  const cur = clamp(Math.round((m.tgt - lo) / m.tstep), 0, vals.length - 1);
  // Centrado en «Ajustar tu meta» (fundador, 2026-11-06: estaba a la izquierda)
  return (
    <View style={{ alignItems: 'center' }}>
      <Counter
        value={fmtMeta(m, m.tgt)}
        unit={`${unitWord(m, m.tgt)} ${per}`.trim()}
        onMinus={() => onChange(stepTarget(m, -1))}
        onPlus={() => onChange(stepTarget(m, 1))}
        onTap={() => setOpen(!open)}
      />
      {open && (
        <View style={[styles.pick, { alignSelf: 'stretch' }]}>
          <View style={styles.pickHead}>
            <Text style={styles.pickTitle}>{m.limit ? t('Your limit') : t('Your target')}</Text>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
              <Text style={styles.link}>{t('Ready')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.wheelRow}>
            <WheelPicker items={vals.map((x) => fmtMeta(m, x))} selectedIndex={cur} onChange={(i) => onChange(vals[i])} width={110} itemHeight={36} visible={3} fadeColor={Colors.backgroundElevated} />
            <Text style={styles.wheelUnit}>{`${unitWord(m, vals[cur])} ${per}`.trim()}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// Un − # + sencillo (para la meta tuya y los días a la semana)
export function SmallStepper({ value, onChange, min = 1, max = 999 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <View style={styles.cnt}>
      <TouchableOpacity style={styles.cntBtn} onPress={() => onChange(Math.max(min, value - 1))} accessibilityLabel={t('Less')}>
        <Text style={styles.cntSign}>−</Text>
      </TouchableOpacity>
      <View style={styles.cntVal}>
        <Text style={styles.cntValText}>{value}</Text>
      </View>
      <TouchableOpacity style={styles.cntBtn} onPress={() => onChange(Math.min(max, value + 1))} accessibilityLabel={t('More')}>
        <Text style={styles.cntSign}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// Botones de opciones (Día / Semana, unidades…)
export function Segmented<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.seg}>
      {options.map(([k, label]) => (
        <TouchableOpacity key={k} style={[styles.segBtn, value === k && styles.segOn]} onPress={() => onChange(k)}>
          <Text style={[styles.segText, value === k && styles.segTextOn]} numberOfLines={1}>
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function Checkbox({ on, disabled, onPress, label }: { on: boolean; disabled?: boolean; onPress: () => void; label: string }) {
  return (
    <TouchableOpacity
      style={[styles.box, on && styles.boxOn, disabled && { opacity: 0.35 }]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on, disabled }}
      accessibilityLabel={label}
      hitSlop={6}
    >
      {on && <Ionicons name="checkmark" size={16} color={Colors.background} />}
    </TouchableOpacity>
  );
}

export const metaStyles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 14, marginBottom: 12 },
  cardList: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, paddingHorizontal: 14, marginBottom: 12 },
  sec: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14, marginBottom: 8 },
  sub: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  h2: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', marginTop: 4 },
  meta: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 8 },
  p: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  label: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 6 },
  btn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  btnText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  btnSoft: { backgroundColor: Colors.accentSoft, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  btnSoftText: { color: Colors.accent, fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider },
  rowT: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  rowD: { color: Colors.textMuted, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  tag: { color: Colors.accent, backgroundColor: Colors.accentSoft, fontSize: 11, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, overflow: 'hidden', alignSelf: 'flex-start', marginTop: 4 },
  link: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  ringPct: { color: Colors.textPrimary, fontSize: 19, fontWeight: '600', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  ringPctBig: { fontSize: 28 },
  ringPctSign: { color: Colors.textSecondary, fontSize: 11, fontWeight: '500', letterSpacing: 0 },
  ringPctSignBig: { fontSize: 14 },
  ringSub: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
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
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: withAlpha(Colors.gold, 0.5),
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  partyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: withAlpha(Colors.gold, 0.16), alignItems: 'center', justifyContent: 'center' },
  partyTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  partyText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  sw: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swLabel: { color: Colors.textMuted, fontSize: 12 },
  swLabelOn: { color: Colors.textPrimary, fontWeight: '700' },
  swTrack: { width: 34, height: 20, borderRadius: 10, backgroundColor: Colors.cardBorder, padding: 2, justifyContent: 'center' },
  swKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.background },
  swKnobOn: { alignSelf: 'flex-end' },
  cnt: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cntBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  cntSign: { color: Colors.textPrimary, fontSize: 18, fontWeight: '600', marginTop: -1 },
  cntVal: { minWidth: 56, height: 32, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  cntValText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  cntUnit: { color: Colors.textSecondary, fontSize: 12.5, flexShrink: 1 },
  item: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider, gap: 8 },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemTitle: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  row2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  todayRow: { minHeight: 34 },
  prog: { color: Colors.textSecondary, fontSize: 13 },
  todayVal: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, paddingHorizontal: 12, height: 32 },
  checkText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  dots: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  dotCol: { alignItems: 'center', gap: 4, flex: 1 },
  dotDay: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  dot: { width: 38, height: 28, borderRadius: 9, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  pick: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 12, marginTop: 6, backgroundColor: Colors.backgroundElevated },
  pickHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pickTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  pickNote: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  link: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  wheelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  wheelUnit: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', minWidth: 70, flexShrink: 1 },
  autoLine: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  yesNo: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 6 },
  seg: { flexDirection: 'row', backgroundColor: Colors.accentSoft, borderRadius: 12, padding: 3, gap: 3, marginBottom: 6 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', paddingHorizontal: 4 },
  segOn: { backgroundColor: Colors.card },
  segText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  segTextOn: { color: Colors.textPrimary, fontWeight: '800' },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: Colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
});
