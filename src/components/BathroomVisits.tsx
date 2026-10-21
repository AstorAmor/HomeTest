import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/colors';
import { WheelPicker } from './WheelPicker';
import { ChoiceChips } from './ChoiceChips';
import { BristolShape, ColorSwatches, UrineDrop } from './BathroomVisuals';
import { dayKey } from '@/data/bathroomRepository';
import { BRISTOL_TYPES, BristolType, STOOL_COLORS, URINE_COLORS } from '@/types/bathroom';
import { dateLocale, t } from '@/i18n';

// Las veces de un día en Orina y Heces (pantalla del día): arriba cuántas veces en total, con − y +, y
// debajo cada vez suelta con su hora y lo que quieras apuntar (color y escozor; o forma, color y prisa).
// Se añaden y se editan aquí mismo, sin cambiar de pantalla. Las sueltas cuentan dentro del total: el −
// se queda gris cuando ya hay tantas sueltas como veces.

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
          accessibilityLabel={t('One time less')}
        >
          <Ionicons name="remove" size={20} color={canDown ? Colors.textPrimary : Colors.textMuted} />
        </TouchableOpacity>
        <Text style={styles.stepValue}>{count ?? '—'}</Text>
        <TouchableOpacity
          style={[styles.stepButton, !canUp && styles.stepButtonOff]}
          onPress={() => onChange((count ?? 0) + 1)}
          disabled={!canUp}
          accessibilityLabel={t('One time more')}
        >
          <Ionicons name="add" size={20} color={canUp ? Colors.textPrimary : Colors.textMuted} />
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
  const shape = BRISTOL_TYPES.find((b) => b.id === draft.consistency);
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
          <View style={styles.shapes}>
            {BRISTOL_TYPES.map((b) => {
              const on = draft.consistency === b.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.shape, on && styles.shapeOn]}
                  onPress={() => onChange({ ...draft, consistency: b.id })}
                  accessibilityLabel={t(b.label)}
                >
                  <BristolShape type={b.id} size={28} />
                </TouchableOpacity>
              );
            })}
          </View>
          {shape && <Text style={styles.shapeLabel}>{t(shape.label)}</Text>}
        </>
      )}

      <Text style={styles.fieldLabel}>{t('Colour')}</Text>
      <ColorSwatches
        options={colorsOf(kind)}
        value={draft.color}
        onChange={(c) => onChange({ ...draft, color: c })}
        center
        shape={kind === 'urine' ? 'drop' : 'circle'}
      />

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
        <TouchableOpacity style={[styles.urgent, draft.urgent && styles.urgentOn]} onPress={() => onChange({ ...draft, urgent: !draft.urgent || undefined })}>
          <Ionicons name={draft.urgent ? 'checkbox' : 'square-outline'} size={20} color={draft.urgent ? Colors.accent : Colors.textMuted} />
          <Text style={styles.urgentText}>{t('I had to rush (urgency)')}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.editorButtons}>
        <TouchableOpacity onPress={onCancel} hitSlop={8}>
          <Text style={styles.cancel}>{t('Cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveVisit} onPress={onSave} activeOpacity={0.85}>
          <Text style={styles.saveVisitText}>{t('Save this time')}</Text>
        </TouchableOpacity>
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

  const summary = (v: Visit) => {
    const colour = colorsOf(kind).find((c) => c.id === v.color);
    const parts =
      kind === 'urine'
        ? [colour && t(colour.label), v.burning && t('Burning')]
        : [v.consistency && t(BRISTOL_TYPES.find((b) => b.id === v.consistency)!.label), colour && t(colour.label), v.urgent && t('Urgency')];
    return parts.filter(Boolean).join(' · ') || t('No details');
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
      <Text style={styles.label}>{t('Each time')}</Text>
      {sorted.length === 0 && !editing && <Text style={styles.empty}>{t('Optional: the time and details of each time.')}</Text>}
      {sorted.map(({ v, i }) =>
        editing?.index === i ? (
          <View key={i}>{editor}</View>
        ) : (
          <View key={i} style={styles.row}>
            <TouchableOpacity style={styles.rowMain} onPress={() => setEditing({ index: i, draft: v })} disabled={!!editing} activeOpacity={0.8}>
              <Text style={styles.time}>{timeText(v.at)}</Text>
              {kind === 'bowel' && v.consistency ? <BristolShape type={v.consistency} size={22} /> : null}
              {v.color && kind === 'urine' ? (
                <UrineDrop color={colorsOf(kind).find((c) => c.id === v.color)?.swatch ?? Colors.textMuted} size={18} cloudy={v.color === 'cloudy'} />
              ) : v.color ? (
                <View style={[styles.dot, { backgroundColor: colorsOf(kind).find((c) => c.id === v.color)?.swatch }]} />
              ) : null}
              <Text style={styles.rowText} numberOfLines={1}>
                {summary(v)}
              </Text>
              <Ionicons name="create-outline" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onChange(visits.filter((_, k) => k !== i))} hitSlop={8} disabled={!!editing} accessibilityLabel={t('Remove')}>
              <Ionicons name="close" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        ),
      )}
      {editing?.index === null
        ? editor
        : !editing &&
          visits.length < max && (
            <TouchableOpacity style={styles.addOne} onPress={() => setEditing({ index: null, draft: { at: defaultTime(day) } })} activeOpacity={0.85}>
              <Ionicons name="add" size={18} color={Colors.accent} />
              <Text style={styles.addOneText}>{t('Add one time')}</Text>
            </TouchableOpacity>
          )}
    </View>
  );
};

const styles = StyleSheet.create({
  stepperWrap: { alignItems: 'center', gap: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonOff: { opacity: 0.4 },
  stepValue: { color: Colors.textPrimary, fontSize: 28, fontWeight: '800', minWidth: 40, textAlign: 'center' },
  stepHint: { color: Colors.textMuted, fontSize: 12 },
  label: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 22, marginBottom: 10 },
  empty: { color: Colors.textMuted, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800', minWidth: 46 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: Colors.cardBorder },
  rowText: { flex: 1, color: Colors.textSecondary, fontSize: 13 },
  addOne: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: withAlpha(Colors.accent, 0.6),
    borderRadius: 22,
    paddingVertical: 10,
    marginTop: 4,
  },
  addOneText: { color: Colors.accent, fontSize: 14, fontWeight: '800' },
  editor: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: withAlpha(Colors.accent, 0.5),
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  editorTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  colon: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', marginHorizontal: 4 },
  fieldLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  shapes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
  shape: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  shapeOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  shapeLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 6 },
  urgent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    padding: 10,
  },
  urgentOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  urgentText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  editorButtons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  cancel: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
  saveVisit: { backgroundColor: Colors.accent, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  saveVisitText: { color: Colors.background, fontSize: 14, fontWeight: '800' },
});
