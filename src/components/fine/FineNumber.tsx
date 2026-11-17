// «− cifra +» con teclado, el mismo en todas las pantallas de apuntar una medición (glucosa, peso, tensión,
// colesterol, cortisol y VO2max). El fundador, 2026-11-16: «el input de glucosa, peso y presión no son coherentes. El
// primero es una rueda, los demás son de +-... me quedo con +- y que se pueda introducir con teclado». Con el aspecto
// del prototipo (`.stp`) y de FineStepper de metas: dos botones redondos con línea fina, la cifra grande y ligera en
// medio y la unidad al lado.
// - Pulsar − o +: un paso. Dejarlo pulsado: sigue contando y, al rato, salta de `fastStep` en `fastStep` (la glucosa,
//   de 5 en 5: de 90 a 140 en un par de segundos) hasta soltar o llegar al límite.
// - Tocar la cifra abre el teclado de números (con coma si lleva decimales); vale la coma o el punto. Lo que ya es una
//   cifra posible cuenta al momento, por si se pulsa Guardar con el teclado abierto. Mientras lo escrito no valga tal
//   cual (a medio escribir o fuera de los límites), `onValidChange(false)` apaga el Guardar; si ya no puede valer
//   (pasa del máximo, por ejemplo), sale en oro con «De … a …». Al salir del campo se ajusta a los límites.
// - `optional`: sin apuntar sale «—»; borrar la cifra la deja sin apuntar y el + empieza en `startAt`.
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { num, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';
import { cannotFit, cleanNumberText, readDraft, stepNumber, wholeDigits, type NumberBounds } from '@/logic/numberStepper';

const FONT = 44;
const FONT_COMPACT = 30; // con `compact`
const FAST_AFTER = 10; // pasos de uno en uno antes de empezar a saltar de `fastStep` en `fastStep`

// Pulsar: un paso. Dejarlo pulsado: un paso cada poco hasta soltar o hasta que ya no se mueva (al llegar al límite
// el botón se apaga y puede que nunca llegue el «soltar»)
function useHold(fn: (fast: boolean) => boolean) {
  const ref = useRef(fn);
  ref.current = fn;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  return {
    onPress: () => {
      ref.current(false);
    },
    onLongPress: () => {
      stop();
      if (!ref.current(false)) return;
      let ticks = 0;
      timer.current = setInterval(() => {
        ticks += 1;
        if (!ref.current(ticks >= FAST_AFTER)) stop();
      }, 90);
    },
    onPressOut: stop,
  };
}

type Common = {
  min: number;
  max: number;
  step?: number; // por defecto, 1 en el último decimal (1; 0,1…)
  fastStep?: number; // al dejarlo pulsado un rato
  decimals?: number;
  unit?: string;
  label: string; // para el lector de pantalla; con `showLabel`, también encima de la cifra
  showLabel?: boolean;
  // Más pequeño, para una pregunta dentro de un cuestionario donde la cifra no es lo principal (la duración del
  // ciclo y de la regla; fundador, 2026-11-17: «ponlo con +-… y que no sea taaan grande»)
  compact?: boolean;
  onValidChange?: (ok: boolean) => void;
  style?: StyleProp<ViewStyle>;
};
type Props = Common &
  (
    | { optional?: false; value: number; onChange: (v: number) => void; startAt?: never }
    | { optional: true; value: number | null; onChange: (v: number | null) => void; startAt: number }
  );

export function FineNumber(props: Props) {
  const { value, min, max, decimals = 0, fastStep, unit, label, showLabel, compact, onValidChange, optional, style } = props;
  const font = compact ? FONT_COMPACT : FONT;
  const step = props.step ?? 1 / 10 ** decimals;
  const onChange = props.onChange as (v: number | null) => void;
  const bounds: NumberBounds = { min, max, decimals };

  const [draft, setDraftState] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const setDraft = (d: string | null) => {
    draftRef.current = d;
    setDraftState(d);
  };
  // Solo se avisa al padre cuando cambia; si se desmonta a medio escribir, que no deje el Guardar apagado
  const okRef = useRef(true);
  const validRef = useRef(onValidChange);
  validRef.current = onValidChange;
  const report = (ok: boolean) => {
    if (okRef.current === ok) return;
    okRef.current = ok;
    validRef.current?.(ok);
  };
  useEffect(
    () => () => {
      if (!okRef.current) validRef.current?.(true);
    },
    [],
  );

  const move = (dir: 1 | -1) => (fast: boolean) => {
    if (value == null) {
      if (dir < 0 || !optional) return false;
      setDraft(null);
      report(true);
      onChange(props.startAt ?? min);
      return true;
    }
    const next = stepNumber(value, dir, step, bounds, fast ? fastStep : undefined);
    if (next === value && draftRef.current == null) return false;
    setDraft(null);
    report(true);
    onChange(next);
    return next !== value;
  };
  const minus = useHold(move(-1));
  const plus = useHold(move(1));

  const onType = (text: string) => {
    const clean = cleanNumberText(text, decimals, wholeDigits(max));
    setDraft(clean);
    const d = readDraft(clean, bounds);
    if (d.value == null) {
      // Vacío: sin apuntar si es opcional; si no, hay que escribir algo antes de guardar
      if (optional) onChange(null);
      report(!!optional);
      return;
    }
    if (d.inRange) onChange(d.value);
    report(d.inRange);
  };
  // Al salir del campo (o con «hecho» en el teclado): se ajusta a los límites
  const commit = () => {
    const d0 = draftRef.current;
    if (d0 == null) return;
    const d = readDraft(d0, bounds);
    if (d.value != null) onChange(d.value);
    else if (optional) onChange(null);
    setDraft(null);
    report(true);
  };

  const canMinus = value != null && value > min;
  const canPlus = value == null || value < max;
  const shown = draft ?? (value == null ? '' : num(value.toFixed(decimals)));
  const bad = draft != null && cannotFit(draft, bounds);
  const range = `${t('From {min} to {max}', { min: num(String(min)), max: num(String(max)) })}${unit ? ` ${unit}` : ''}`;
  // Ancho fijo para la cifra más larga posible: en la web un campo de texto grande ocupa media pantalla y echaba
  // fuera el − y el +, y así el + no se mueve al cambiar la cifra
  const width = Math.round((wholeDigits(max) + decimals) * 0.64 * font + (decimals ? 0.3 * font : 0) + 14);

  return (
    <View style={[styles.block, style]}>
      {showLabel ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, compact && styles.btnCompact, !canMinus && styles.off]}
          disabled={!canMinus}
          {...minus}
          delayLongPress={350}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${t('Less')}`}
          accessibilityState={{ disabled: !canMinus }}
          hitSlop={4}
        >
          <Text style={[styles.sign, compact && styles.signCompact]}>−</Text>
        </TouchableOpacity>
        <TextInput
          style={[styles.val, compact && styles.valCompact, { width }, bad && styles.valBad]}
          value={shown}
          placeholder="—"
          placeholderTextColor={FINE.mute}
          onChangeText={onType}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
          selectTextOnFocus
          returnKeyType="done"
          accessibilityLabel={unit ? `${label} (${unit})` : label}
          accessibilityHint={range}
        />
        <TouchableOpacity
          style={[styles.btn, compact && styles.btnCompact, !canPlus && styles.off]}
          disabled={!canPlus}
          {...plus}
          delayLongPress={350}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${t('More')}`}
          accessibilityState={{ disabled: !canPlus }}
          hitSlop={4}
        >
          <Text style={[styles.sign, compact && styles.signCompact]}>+</Text>
        </TouchableOpacity>
        {unit ? (
          <Text style={[styles.unit, showLabel && styles.unitStacked]} numberOfLines={1}>
            {unit}
          </Text>
        ) : null}
      </View>
      {bad ? (
        <Text style={styles.hint} accessibilityLiveRegion="polite">
          {range}
        </Text>
      ) : null}
    </View>
  );
}

// Para el Guardar de cada pantalla: `ready` es false mientras alguna cifra a medio escribir no valga tal cual.
// <FineNumber … onValidChange={numbers.watch('kg')} /> y <FineButton disabled={!numbers.ready} />
export function useNumbersReady() {
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const watch = useCallback(
    (key: string) => (ok: boolean) => setPending((p) => (!!p[key] === !ok ? p : { ...p, [key]: !ok })),
    [],
  );
  return { ready: !Object.values(pending).some(Boolean), watch };
}

const styles = StyleSheet.create({
  block: { alignItems: 'center' },
  // El nombre encima, en pequeño y apagado (como las cabeceras de sección): la tensión, con sus tres cifras
  label: { ...fine.secTitle, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  btn: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(240,239,230,0.16)', alignItems: 'center', justifyContent: 'center' },
  btnCompact: { width: 40, height: 40, borderRadius: 20 },
  off: { opacity: 0.35 },
  sign: { ...ff('light'), fontSize: 24, lineHeight: 28, color: FINE.ivory, marginTop: -2 },
  signCompact: { fontSize: 21, lineHeight: 25 },
  val: { ...ff('light'), textAlign: 'center', fontSize: FONT, lineHeight: 52, color: FINE.ivory, fontVariant: ['tabular-nums'], padding: 0 },
  valCompact: { fontSize: FONT_COMPACT, lineHeight: 38 },
  // Lo que ya no puede valer, en oro (sin rojo de alarma)
  valBad: { color: FINE.gold },
  unit: { ...ff('regular'), fontSize: 15, color: FINE.mute },
  // Con el nombre encima van varias seguidas (la tensión): ancho mínimo para «mmHg» o «lpm», así quedan una encima
  // de otra
  unitStacked: { minWidth: 44 },
  hint: { ...ff('regular'), fontSize: 12.5, lineHeight: 18, color: FINE.gold, marginTop: 6 },
});
