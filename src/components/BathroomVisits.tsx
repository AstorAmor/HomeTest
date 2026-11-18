import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WheelPicker } from './WheelPicker';
import { ChoiceChips } from './ChoiceChips';
import { BristolRuler, StoolColorPicker, UrineColorPicker } from './BathroomVisuals';
import { Pill, SecHead } from './fine/Fine';
import { FLink, FMark } from './fine/FineForm';
import { dayKey } from '@/data/bathroomRepository';
import { BRISTOL_TYPES, BristolType, STOOL_COLORS, StoolColor, URINE_COLORS } from '@/types/bathroom';
import { dateLocale, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Las veces de un día en Orina y Heces (pantalla del día): arriba cuántas veces en total, con − y +, y
// debajo cada vez suelta con su hora y lo que quieras apuntar (color y escozor; o forma, color y prisa).
// Se añaden y se editan aquí mismo, sin cambiar de pantalla. Las sueltas cuentan dentro del total: el −
// se queda gris cuando ya hay tantas sueltas como veces.
// Desde el 2026-11-16, en el lenguaje fino del prototipo (src/theme/fine.ts): «− cifra +» con botones redondos de
// línea fina y la cifra grande y ligera, cada vez en una fila con línea fina debajo, «Añadir una vez» en jade y la
// vez que se edita en una tarjeta casi transparente con borde jade, sin cajas de color.
// Desde el 2026-11-17 (fundador: en «Cada vez» «rompes la coherencia y vuelves a poner las gotitas en forma de gota
// y el color. Lo pondría como "El día en general" y no pondría el color seleccionado (que se vea en la regla)»):
// al editar una vez, el color se elige con la misma regla que en «El día en general» (y en Heces, las dos reglas de
// color y la de la consistencia), sin gotas ni circulitos; y en la fila de cada vez ya no sale la muestra del color
// ni su nombre: solo la hora y, en palabras, lo demás.

export type Visit = { at: string; color?: string; burning?: boolean; consistency?: BristolType; urgent?: boolean };
type Kind = 'urine' | 'bowel';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const colorsOf = (kind: Kind) => (kind === 'urine' ? URINE_COLORS : STOOL_COLORS) as { id: string; label: string; swatch: string }[];
const timeText = (iso: string) => new Date(iso).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

// Hoy, ahora (redondeado a 5 min); otro día, a mediodía
const defaultTime = (day: string) => {
  const d = day === dayKey(new Date()) ? new Date() : new Date(`${day}T12:00:00`);
  d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0);
  return d.toISOString();
};

// «− 4 +» (prototipo, `.stp`); «—» apagado mientras no se ha dicho cuántas
export const DayCountStepper = ({
  count,
  min,
  max,
  onChange,
}: {
  count: number | null; // null = aún sin decir
  min: number; // las veces sueltas apuntadas
  max: number;
  onChange: (n: number) => void;
}) => {
  const canDown = count === null ? min === 0 : count > min;
  const canUp = (count ?? 0) < max;
  return (
    <View style={styles.stepperWrap}>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={[styles.stepButton, !canDown && styles.stepButtonOff]}
          onPress={() => onChange(count === null ? 0 : count - 1)}
          disabled={!canDown}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={t('One time less')}
        >
          <Text style={styles.stepSign}>−</Text>
        </TouchableOpacity>
        <Text style={[styles.stepValue, count === null && styles.stepValueEmpty]} accessibilityLiveRegion="polite">
          {count ?? '—'}
        </Text>
        <TouchableOpacity
          style={[styles.stepButton, !canUp && styles.stepButtonOff]}
          onPress={() => onChange((count ?? 0) + 1)}
          disabled={!canUp}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={t('One time more')}
        >
          <Text style={styles.stepSign}>+</Text>
        </TouchableOpacity>
      </View>
      {min > 0 && <Text style={styles.stepHint}>{t('{n} of them with details below', { n: min })}</Text>}
    </View>
  );
};

const VisitEditor = ({
  kind,
  day,
  draft,
  isNew,
  onChange,
  onSave,
  onCancel,
}: {
  kind: Kind;
  day: string;
  draft: Visit;
  isNew: boolean;
  onChange: (v: Visit) => void;
  onSave: () => void;
  onCancel: () => void;
}) => {
  const d = new Date(draft.at);
  const h = d.getHours();
  const m = Math.min(11, Math.round(d.getMinutes() / 5));
  const setTime = (hh: number, mm: number) => {
    const x = new Date(`${day}T00:00:00`);
    x.setHours(hh, mm * 5, 0, 0);
    onChange({ ...draft, at: x.toISOString() });
  };
  return (
    <View style={styles.editor}>
      <Text style={styles.editorTitle}>{isNew ? t('New time') : t('Edit this time')}</Text>
      <View style={styles.wheels}>
        <WheelPicker items={HOURS} selectedIndex={h} onChange={(i) => setTime(i, m)} width={64} itemHeight={32} />
        <Text style={styles.colon}>:</Text>
        <WheelPicker items={MINUTES} selectedIndex={m} onChange={(i) => setTime(h, i)} width={64} itemHeight={32} />
      </View>

      {kind === 'bowel' && (
        <>
          <Text style={styles.fieldLabel}>{t('Consistency')}</Text>
          <BristolRuler value={draft.consistency} onChange={(b) => onChange({ ...draft, consistency: b })} />
        </>
      )}

      {/* El color, con la misma regla que en «El día en general» y sin repetir debajo el elegido: se ve en la regla */}
      <Text style={styles.fieldLabel}>{t('Colour')}</Text>
      {kind === 'urine' ? (
        <UrineColorPicker options={colorsOf(kind)} value={draft.color} onChange={(c) => onChange({ ...draft, color: c })} compact />
      ) : (
        <StoolColorPicker value={draft.color as StoolColor | undefined} onChange={(c) => onChange({ ...draft, color: c })} compact />
      )}

      {kind === 'urine' ? (
        <>
          <Text style={styles.fieldLabel}>{t('Any burning or pain?')}</Text>
          <ChoiceChips
            options={[{ id: 'no', label: t('No') }, { id: 'yes', label: t('Yes') }]}
            value={draft.burning == null ? undefined : draft.burning ? 'yes' : 'no'}
            onChange={(v) => onChange({ ...draft, burning: v === 'yes' })}
            center
          />
        </>
      ) : (
        <TouchableOpacity
          style={styles.urgent}
          onPress={() => onChange({ ...draft, urgent: !draft.urgent || undefined })}
          activeOpacity={0.75}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!draft.urgent }}
        >
          <Text style={[fine.rowTitle, styles.flex]}>{t('I had to rush (urgency)')}</Text>
          <FMark on={!!draft.urgent} />
        </TouchableOpacity>
      )}

      <View style={styles.editorButtons}>
        <FLink label={t('Cancel')} onPress={onCancel} muted />
        <Pill label={t('Save this time')} onPress={onSave} />
      </View>
    </View>
  );
};

export const VisitsSection = ({
  kind,
  day,
  visits,
  max,
  onChange,
}: {
  kind: Kind;
  day: string;
  visits: Visit[];
  max: number;
  onChange: (visits: Visit[], saved?: Visit) => void; // saved: la que se acaba de guardar
}) => {
  const [editing, setEditing] = useState<{ index: number | null; draft: Visit } | null>(null);
  const sorted = visits.map((v, i) => ({ v, i })).sort((a, b) => a.v.at.localeCompare(b.v.at));

  const save = () => {
    if (!editing) return;
    const next = [...visits];
    if (editing.index === null) next.push(editing.draft);
    else next[editing.index] = editing.draft;
    onChange(next, editing.draft);
    setEditing(null);
  };

  // Lo de cada vez, en palabras seguidas por comas («Lisa y blanda, con prisa»). `withColour`: también el color, solo
  // para los lectores de pantalla; en la fila no sale (se ve en la regla al abrir esa vez)
  const summary = (v: Visit, withColour = false) => {
    const colour = colorsOf(kind).find((c) => c.id === v.color);
    const parts =
      kind === 'urine'
        ? [withColour && colour && t(colour.label), v.burning && t('Burning')]
        : [v.consistency && t(BRISTOL_TYPES.find((b) => b.id === v.consistency)!.label), withColour && colour && t(colour.label), v.urgent && t('Urgency')];
    const words = parts.filter(Boolean) as string[];
    if (!words.length) return colour ? '' : t('No details');
    return words.map((w, i) => (i ? w.charAt(0).toLowerCase() + w.slice(1) : w)).join(', ');
  };

  const editor = (
    <VisitEditor
      kind={kind}
      day={day}
      draft={editing?.draft ?? { at: defaultTime(day) }}
      isNew={editing?.index === null}
      onChange={(draft) => setEditing((e) => (e ? { ...e, draft } : e))}
      onSave={save}
      onCancel={() => setEditing(null)}
    />
  );

  return (
    <View>
      <SecHead title={t('Each time')} />
      {sorted.length === 0 && !editing && <Text style={styles.empty}>{t('Optional: the time and details of each time.')}</Text>}
      {sorted.map(({ v, i }) =>
        editing?.index === i ? (
          <View key={i}>{editor}</View>
        ) : (
          <View key={i} style={[fine.row, !!editing && styles.dimmed]}>
            <TouchableOpacity
              style={styles.rowMain}
              onPress={() => setEditing({ index: i, draft: v })}
              disabled={!!editing}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={[timeText(v.at), summary(v, true)].filter(Boolean).join(', ')}
              accessibilityHint={t('Edit this time')}
            >
              <Text style={styles.time}>{timeText(v.at)}</Text>
              <Text style={styles.rowText} numberOfLines={1}>
                {summary(v)}
              </Text>
              <Ionicons name="create-outline" size={15} color={FINE.mute} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onChange(visits.filter((_, k) => k !== i))}
              hitSlop={10}
              disabled={!!editing}
              accessibilityRole="button"
              accessibilityLabel={t('Remove')}
            >
              <Ionicons name="close" size={18} color={FINE.mute} />
            </TouchableOpacity>
          </View>
        ),
      )}
      {editing?.index === null
        ? editor
        : !editing &&
          visits.length < max && (
            <FLink icon="add" label={t('Add one time')} onPress={() => setEditing({ index: null, draft: { at: defaultTime(day) } })} style={styles.addOne} />
          )}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // «− cifra +» (prototipo, `.stp`): botones redondos con línea fina y la cifra grande y ligera
  stepperWrap: { alignItems: 'center', gap: 6, marginTop: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  stepButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(240,239,230,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonOff: { opacity: 0.35 },
  stepSign: { ...ff('light'), fontSize: 24, lineHeight: 28, color: FINE.ivory, marginTop: -2 },
  // Ancho fijo: así el + no se mueve al pasar de 9 a 10
  stepValue: { ...ff('light'), width: 96, textAlign: 'center', fontSize: 44, lineHeight: 52, color: FINE.ivory, fontVariant: ['tabular-nums'] },
  stepValueEmpty: { color: FINE.mute },
  stepHint: { ...fine.note, marginTop: 0 },
  empty: { ...fine.note, marginTop: 0 },
  dimmed: { opacity: 0.5 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { ...ff('regular'), color: FINE.ivory, fontSize: 14.5, width: 50, fontVariant: ['tabular-nums'] },
  rowText: { ...ff('regular'), flex: 1, color: FINE.mute, fontSize: 13 },
  addOne: { marginTop: 2 },
  // La vez que se edita: tarjeta casi transparente con un borde jade
  editor: {
    backgroundColor: FINE.tile,
    borderWidth: 1,
    borderColor: FINE.jadeLine,
    borderRadius: 14,
    padding: 14,
    marginVertical: 8,
  },
  editorTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 15, textAlign: 'center' },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  colon: { ...ff('light'), color: FINE.ivory, fontSize: 24, marginHorizontal: 4 },
  fieldLabel: { ...fine.kicker, textAlign: 'center', marginTop: 16, marginBottom: 8 },
  urgent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingVertical: 10,
    minHeight: 48,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: FINE.line,
  },
  editorButtons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
});
