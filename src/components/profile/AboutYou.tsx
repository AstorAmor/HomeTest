// «Sobre ti» en Mi perfil: cada dato en una fila fina con su valor y, al tocarla, se cambia ahí mismo en una hoja
// abajo, sin pasar por la pantalla de editar (fundador, 2026-11-16). Elegir entre opciones guarda al tocar; la fecha
// de nacimiento (ruedas), la altura y el peso («− n +»), la medicación y las enfermedades (con su cuadro de texto)
// llevan «Guardar». Se guarda con lo mismo que el cuestionario: profileRepository y las secciones que encienden
// las respuestas (saveProfileChange, en profileFields.ts).
import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Chev } from '@/components/fine/Fine';
import { FOption, formStyles } from '@/components/fine/FineForm';
import { FineStepper } from '@/components/metas/FineStepper';
import { WheelPicker } from '@/components/WheelPicker';
import { ageFromDob, CONDITION_OPTIONS, ConditionId, UserProfile } from '@/data/profileRepository';
import { num, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';
import { FieldSheet } from './FieldSheet';
import {
  ACTIVITY_OPTIONS,
  ALCOHOL_OPTIONS,
  DAYS,
  DAYS_OPTIONS,
  DEFAULT_DOB,
  DEFAULT_HEIGHT_CM,
  DEFAULT_WEIGHT_KG,
  HEIGHTS,
  SEX_OPTIONS,
  SLEEP_OPTIONS,
  SMOKING_OPTIONS,
  STEPS_OPTIONS,
  WEIGHTS,
  YEARS,
  daysInMonth,
  dobFromWheels,
  monthLabels,
  saveProfileChange,
  toggleConditionIn,
  wheelsFromDob,
} from './profileFields';

export type AboutField =
  | 'dob'
  | 'sex'
  | 'height'
  | 'weight'
  | 'activity'
  | 'strength'
  | 'cardio'
  | 'steps'
  | 'sleep'
  | 'smoking'
  | 'alcohol'
  | 'medication'
  | 'conditions';

// Cómo se ve cada respuesta en su fila (en inglés; se traduce al pintar)
const SHOWN: Record<string, string> = {
  female: 'Female',
  male: 'Male',
  other: 'Other',
  undisclosed: 'Prefer not to say',
  sedentary: 'Mostly sitting',
  light: 'Light activity',
  active: 'Fairly active',
  very_active: 'Very active',
  lt6: '< 6 h',
  '6to7': '6–7 h',
  '7to8': '7–8 h',
  gt8: '> 8 h',
  never: 'Never',
  former: 'Used to',
  current: 'Yes',
  occasional: 'Occasionally',
  weekly: 'Every week',
  daily: 'Daily',
  lt5k: 'Fewer than 5,000',
  '5to7k': '5,000-7,500',
  '7to10k': '7,500-10,000',
  gt10k: 'More than 10,000',
  unknown: "I don't know",
};
const shown = (id?: string) => (id ? t(SHOWN[id] ?? id) : undefined);
const daysText = (n?: number) =>
  n == null ? undefined : n === 0 ? t('None') : n >= 3 ? t('3 or more a week') : n === 1 ? t('1 day a week') : t('{n} days a week', { n });
const round1 = (x: number) => Math.round(x * 10) / 10;

function aboutRows(p: UserProfile | null): { key: AboutField; label: string; value?: string }[] {
  const age = ageFromDob(p?.dateOfBirth);
  return [
    { key: 'dob', label: t('Age'), value: age != null ? `${age}` : undefined },
    { key: 'sex', label: t('Sex'), value: shown(p?.sex) },
    { key: 'height', label: t('Height'), value: p?.heightCm ? `${num(round1(p.heightCm))} cm` : undefined },
    { key: 'weight', label: t('Weight'), value: p?.weightKg ? `${num(round1(p.weightKg))} kg` : undefined },
    { key: 'activity', label: t('Activity'), value: shown(p?.activity) },
    { key: 'strength', label: t('Strength'), value: daysText(p?.strengthDays) },
    { key: 'cardio', label: t('Cardio'), value: daysText(p?.cardioDays) },
    { key: 'steps', label: t('Steps a day'), value: shown(p?.stepsBand) },
    { key: 'sleep', label: t('Sleep'), value: shown(p?.sleep) },
    { key: 'smoking', label: t('Smoking'), value: shown(p?.smoking) },
    { key: 'alcohol', label: t('Alcohol'), value: shown(p?.alcohol) },
    {
      key: 'medication',
      label: t('Medication'),
      value: p?.takesMedication === undefined ? undefined : p.takesMedication ? p.medications || t('Yes') : t('None'),
    },
    {
      key: 'conditions',
      label: t('Conditions'),
      value: p?.conditions?.length
        ? p.conditions
            .map((c) => (c === 'other' ? p.conditionsOther || t('Other') : t(CONDITION_OPTIONS.find((o) => o.id === c)?.label ?? c)))
            .join(', ')
        : undefined,
    },
  ];
}

// Las filas: el dato, su valor (o «Sin responder», apagado) y la flecha. Hasta que carga el perfil no se abren.
export function AboutYouRows({ profile, onEdit }: { profile: UserProfile | null; onEdit: (field: AboutField) => void }) {
  const rows = aboutRows(profile);
  return (
    <View>
      {rows.map((r, i) => {
        const value = r.value ?? t('Not answered');
        return (
          <TouchableOpacity
            key={r.key}
            style={[fine.row, i === rows.length - 1 && styles.last]}
            onPress={() => onEdit(r.key)}
            disabled={!profile}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('{label}: {value}, edit', { label: r.label, value })}
          >
            <Text style={styles.label}>{r.label}</Text>
            <Text style={[styles.value, !r.value && styles.empty]} numberOfLines={2}>
              {value}
            </Text>
            <Chev />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

type SheetProps = {
  profile: UserProfile;
  save: (patch: Partial<UserProfile>) => void;
  busy: boolean;
  error: string;
  onClose: () => void;
};

// La hoja de un dato. Si guardar falla, se queda abierta con el aviso para volver a intentarlo.
export function AboutYouSheet({
  field,
  profile,
  onClose,
  onSaved,
}: {
  field: AboutField;
  profile: UserProfile;
  onClose: () => void;
  onSaved: (profile: UserProfile) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (patch: Partial<UserProfile>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onSaved(await saveProfileChange(patch));
      onClose();
    } catch {
      setError(t('Could not save'));
      setBusy(false);
    }
  };
  const p: SheetProps = { profile, save, busy, error, onClose };
  const activityLead = t('Roughly is fine. If you log your workouts or connect a watch, your plan will use that instead.');
  const bodyLead = t('Used for body composition and energy needs.');
  const days = (n?: number) => (n != null ? String(n) : undefined);

  switch (field) {
    case 'dob':
      return <DobSheet {...p} />;
    case 'sex':
      return (
        <ChoiceSheet
          {...p}
          title={t("What's your biological sex?")}
          sub={t('Many markers (iron, hormones…) have different ranges.')}
          options={SEX_OPTIONS}
          value={profile.sex}
          onPick={(sex) => save({ sex })}
        />
      );
    case 'height':
      return (
        <NumberSheet
          {...p}
          title={t('Height')}
          sub={bodyLead}
          unit={t('cm')}
          initial={profile.heightCm}
          fallback={DEFAULT_HEIGHT_CM}
          lo={Number(HEIGHTS[0])}
          hi={Number(HEIGHTS[HEIGHTS.length - 1])}
          onSave={(heightCm) => save({ heightCm })}
        />
      );
    case 'weight':
      return (
        <NumberSheet
          {...p}
          title={t('Weight')}
          sub={bodyLead}
          unit={t('kg')}
          initial={profile.weightKg}
          fallback={DEFAULT_WEIGHT_KG}
          lo={Number(WEIGHTS[0])}
          hi={Number(WEIGHTS[WEIGHTS.length - 1])}
          onSave={(weightKg) => save({ weightKg })}
        />
      );
    case 'activity':
      return <ChoiceSheet {...p} title={t('How active are you?')} sub={activityLead} options={ACTIVITY_OPTIONS} value={profile.activity} onPick={(activity) => save({ activity })} />;
    case 'strength':
      return (
        <ChoiceSheet
          {...p}
          title={t('How many days a week do you do strength training?')}
          sub={activityLead}
          options={DAYS_OPTIONS}
          value={days(profile.strengthDays)}
          onPick={(v) => save({ strengthDays: Number(v) })}
        />
      );
    case 'cardio':
      return (
        <ChoiceSheet
          {...p}
          title={t('How many days a week do you do cardio (running, cycling, swimming…)?')}
          sub={activityLead}
          options={DAYS_OPTIONS}
          value={days(profile.cardioDays)}
          onPick={(v) => save({ cardioDays: Number(v) })}
        />
      );
    case 'steps':
      return <ChoiceSheet {...p} title={t('How many steps do you walk a day?')} sub={activityLead} options={STEPS_OPTIONS} value={profile.stepsBand} onPick={(stepsBand) => save({ stepsBand })} />;
    case 'sleep':
      return <ChoiceSheet {...p} title={t('How much do you usually sleep?')} options={SLEEP_OPTIONS} value={profile.sleep} onPick={(sleep) => save({ sleep })} />;
    case 'smoking':
      return <ChoiceSheet {...p} title={t('Do you smoke?')} options={SMOKING_OPTIONS} value={profile.smoking} onPick={(smoking) => save({ smoking })} />;
    case 'alcohol':
      return <ChoiceSheet {...p} title={t('How often do you drink alcohol?')} options={ALCOHOL_OPTIONS} value={profile.alcohol} onPick={(alcohol) => save({ alcohol })} />;
    case 'medication':
      return <MedicationSheet {...p} />;
    case 'conditions':
      return <ConditionsSheet {...p} />;
  }
}

// Pie de cada hoja: el aviso si no se pudo guardar, «Guardar» (si hace falta) y «Cancelar», como la hoja de un día
function Acts({ onSave, canSave = true, busy, error, onClose }: { onSave?: () => void; canSave?: boolean; busy: boolean; error: string; onClose: () => void }) {
  const off = !canSave || busy;
  return (
    <>
      {error ? <Text style={[formStyles.error, styles.error]}>{error}</Text> : null}
      <View style={styles.acts}>
        {onSave ? (
          <TouchableOpacity
            style={[fine.pill, styles.save, off && styles.off]}
            onPress={onSave}
            disabled={off}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('Save')}
            accessibilityState={{ disabled: off, busy }}
          >
            {busy ? <ActivityIndicator size="small" color={FINE.ivory} /> : <Text style={fine.pillText}>{t('Save')}</Text>}
          </TouchableOpacity>
        ) : busy ? (
          <ActivityIndicator size="small" color={FINE.jade} />
        ) : null}
        <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityRole="button">
          <Text style={fine.link}>{t('Cancel')}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

// Una sola entre varias: tocar una la guarda y cierra (tocar la que ya estaba, solo cierra)
function ChoiceSheet<T extends string>({
  title,
  sub,
  options,
  value,
  onPick,
  busy,
  error,
  onClose,
}: Omit<SheetProps, 'profile' | 'save'> & {
  title: string;
  sub?: string;
  options: { id: T; label: string }[];
  value?: T;
  onPick: (v: T) => void;
}) {
  return (
    <FieldSheet title={title} sub={sub} onClose={onClose} footer={<Acts busy={busy} error={error} onClose={onClose} />}>
      {options.map((o, i) => (
        <FOption
          key={o.id}
          title={t(o.label)}
          on={o.id === value}
          onPress={() => (busy ? undefined : o.id === value ? onClose() : onPick(o.id))}
          last={i === options.length - 1}
        />
      ))}
    </FieldSheet>
  );
}

// Altura o peso: «− n +» de uno en uno (el peso que llega de la báscula con decimales salta al entero de al lado)
function NumberSheet({
  title,
  sub,
  unit,
  initial,
  fallback,
  lo,
  hi,
  onSave,
  busy,
  error,
  onClose,
}: Omit<SheetProps, 'profile' | 'save'> & {
  title: string;
  sub?: string;
  unit: string;
  initial?: number;
  fallback: number;
  lo: number;
  hi: number;
  onSave: (v: number) => void;
}) {
  // Sin contestar, parte del mismo valor que las ruedas del cuestionario; si no se toca, «Guardar» solo cierra
  const start = initial ? round1(initial) : fallback;
  const [v, setV] = useState(start);
  return (
    <FieldSheet
      title={title}
      sub={sub}
      scroll={false}
      onClose={onClose}
      footer={<Acts onSave={() => (initial && v === start ? onClose() : onSave(v))} busy={busy} error={error} onClose={onClose} />}
    >
      <FineStepper
        value={num(v)}
        unit={unit}
        onMinus={() => setV((x) => Math.max(lo, Math.ceil(x) - 1))}
        onPlus={() => setV((x) => Math.min(hi, Math.floor(x) + 1))}
        canMinus={v > lo}
        canPlus={v < hi}
        style={styles.stepper}
      />
    </FieldSheet>
  );
}

// Fecha de nacimiento: las mismas ruedas que el cuestionario (día, mes y año), con el mes en el idioma de la app
function DobSheet({ profile, save, busy, error, onClose }: SheetProps) {
  const start = wheelsFromDob(profile.dateOfBirth) ?? DEFAULT_DOB;
  const [day, setDay] = useState(start.day);
  const [month, setMonth] = useState(start.month);
  const [year, setYear] = useState(start.year);
  const months = useMemo(monthLabels, []);
  const onSave = () => save({ dateOfBirth: dobFromWheels(Math.min(day, daysInMonth(month, year) - 1), month, year) });
  return (
    <FieldSheet
      title={t('When were you born?')}
      sub={t('Reference ranges change with age.')}
      scroll={false}
      onClose={onClose}
      footer={<Acts onSave={onSave} busy={busy} error={error} onClose={onClose} />}
    >
      <View style={styles.wheels}>
        <WheelPicker items={DAYS} selectedIndex={day} onChange={setDay} width={72} />
        <WheelPicker items={months} selectedIndex={month} onChange={setMonth} width={100} />
        <WheelPicker items={YEARS} selectedIndex={year} onChange={setYear} width={100} />
      </View>
    </FieldSheet>
  );
}

function SheetInput({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (s: string) => void; placeholder: string; autoFocus: boolean }) {
  return (
    <TextInput
      style={[formStyles.input, styles.input]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={FINE.mute}
      multiline
      autoFocus={autoFocus}
      accessibilityLabel={placeholder}
    />
  );
}

// Medicación: no / sí y, si toma, cuáles (como en el cuestionario: se guarda sin espacios de más)
function MedicationSheet({ profile, save, busy, error, onClose }: SheetProps) {
  const [takes, setTakes] = useState(profile.takesMedication);
  const [text, setText] = useState(profile.medications ?? '');
  const [touched, setTouched] = useState(false);
  const pick = (v: boolean) => {
    setTakes(v);
    setTouched(true);
  };
  let input: ReactNode = null;
  if (takes) input = <SheetInput value={text} onChange={setText} placeholder={t('Which ones? e.g. levothyroxine 50 µg, contraceptive pill')} autoFocus={touched} />;
  return (
    <FieldSheet
      title={t('Do you take any regular medication?')}
      sub={t('Some medicines and conditions change how results should be read. Only you and the professionals you choose can see this.')}
      onClose={onClose}
      footer={
        <>
          {input}
          <Acts
            onSave={() => takes !== undefined && save({ takesMedication: takes, medications: takes ? text.trim() : undefined })}
            canSave={takes !== undefined}
            busy={busy}
            error={error}
            onClose={onClose}
          />
        </>
      }
    >
      <FOption title={t('No')} on={takes === false} onPress={() => pick(false)} />
      <FOption title={t('Yes')} on={takes === true} onPress={() => pick(true)} last />
    </FieldSheet>
  );
}

// Enfermedades: varias a la vez («Ninguna» va sola) y, con «Otra», cuál. El SOP solo sale a las mujeres.
function ConditionsSheet({ profile, save, busy, error, onClose }: SheetProps) {
  const [list, setList] = useState<ConditionId[]>(profile.conditions ?? []);
  const [other, setOther] = useState(profile.conditionsOther ?? '');
  const [touched, setTouched] = useState(false);
  const options = CONDITION_OPTIONS.filter((c) => !c.femaleOnly || profile.sex === 'female');
  const withOther = list.includes('other');
  const toggle = (id: ConditionId) => {
    setList((l) => toggleConditionIn(l, id));
    setTouched(true);
  };
  return (
    <FieldSheet
      title={t('Have you been diagnosed with any condition?')}
      onClose={onClose}
      footer={
        <>
          {withOther ? <SheetInput value={other} onChange={setOther} placeholder={t('Tell us which')} autoFocus={touched} /> : null}
          <Acts
            onSave={() => save({ conditions: list, conditionsOther: withOther ? other.trim() : undefined })}
            busy={busy}
            error={error}
            onClose={onClose}
          />
        </>
      }
    >
      {options.map((c, i) => (
        <FOption key={c.id} multi title={t(c.label)} on={list.includes(c.id)} onPress={() => toggle(c.id)} last={i === options.length - 1} />
      ))}
    </FieldSheet>
  );
}

const styles = StyleSheet.create({
  last: { borderBottomWidth: 0 },
  label: { ...fine.rowTitle, flexShrink: 0, maxWidth: '50%' },
  value: { ...fine.rowValue, flex: 1, textAlign: 'right' },
  empty: { ...ff('regular'), color: FINE.mute },
  acts: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 22 },
  save: { minWidth: 92 },
  off: { opacity: 0.45 },
  error: { marginTop: 12 },
  stepper: { marginTop: 18, marginBottom: 4 },
  wheels: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  input: { marginTop: 14, maxHeight: 96, textAlignVertical: 'top' },
});
