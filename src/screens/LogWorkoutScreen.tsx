import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GlowRing, ringTones } from '@/components/GlowRing';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { KeyboardFooter } from '@/components/KeyboardFooter';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SecHead } from '@/components/fine/Fine';
import { FChips, FOption, formStyles } from '@/components/fine/FineForm';
import { CloseButton, FineButton, measureStyles, SecRow } from '@/components/fine/FineMeasure';
import { FineNumber, useNumbersReady } from '@/components/fine/FineNumber';
import { PathEmblem } from '@/components/fine/RoleEmblem';
import { WorkoutModal } from '@/components/workouts/WorkoutModal';
import { WorkoutTypeIcon, workoutTypePath } from '@/components/workouts/WorkoutTypeIcon';
import { strengthSessionsThisWeek, workoutRepository, WorkoutEntry, WorkoutType } from '@/data/planRepository';
import { OTHER_SPORT, SPORT_NAME_MAX, sportName, sportOptions, sportToSave } from '@/logic/workoutSports';
import { t as tr } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// 'sport' es «Otro» (fundador, 2026-11-17: «Cambia "deporte" por "Otro"»): lo que no es claramente fuerza ni cardio
const TYPES: { id: WorkoutType; label: string; hint: string }[] = [
  { id: 'strength', label: 'Strength', hint: 'Weights, machines or your own body weight' },
  { id: 'cardio', label: 'Cardio', hint: 'Running, cycling, swimming, brisk walking' },
  { id: 'mobility', label: 'Mobility', hint: 'Stretching, yoga, pilates' },
  { id: 'sport', label: 'Other', hint: 'Team sports, racket sports, dance and more' },
];
const INTENSITIES: { id: WorkoutEntry['intensity']; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'hard', label: 'Hard' },
];
const EMBLEM = 40; // el aro con el dibujo de cada tipo
const MAX_MINUTES = 600;

// Apuntar un entreno (la K de Kuova → «Entrenamiento», y Entrenamientos → «Apuntar un entrenamiento que hiciste»).
// Se pueden marcar varios tipos (p. ej. fuerza + cardio en la misma sesión): se guarda un registro por tipo y los
// minutos se reparten entre ellos, así no se cuentan dos veces. Desde el plan, el cardio llega ya marcado
// (?type=cardio).
// En el lenguaje fino, como el resto de registros (fundador, 2026-11-17: «la estética no es coherente en los
// iconos»): el título con la × a la derecha, los tipos en filas con una línea fina, su dibujo a línea en un aro (las
// pesas, las del entrenador personal) y el círculo de marcar; los minutos con «− +» y teclado, la intensidad en
// chips y el botón esmeralda abajo.
// Con «Otro» se abre la lista de deportes (deportes de equipo, de raqueta y cosas raras como el buceo), con «Otro»
// al final para escribir el nombre. El deporte se guarda con el entreno (src/logic/workoutSports.ts).
// Al guardar, el aro que se cierra con la semana y el dibujo del tipo; sin confeti (fundador: «no quiero ¡confeti!»).
export const LogWorkoutScreen = () => {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const [types, setTypes] = useState<WorkoutType[]>([TYPES.find((x) => x.id === type)?.id ?? 'strength']);
  const [sport, setSport] = useState<string | null>(null); // lo elegido en la lista: la clave de un deporte u OTHER_SPORT
  const [sportText, setSportText] = useState(''); // con «Otro», el nombre escrito
  const [picking, setPicking] = useState(false);
  const [minutes, setMinutes] = useState(45);
  const [intensity, setIntensity] = useState<WorkoutEntry['intensity']>('moderate');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const numbers = useNumbersReady();
  // Si falla a medias y se vuelve a intentar, no se repiten los registros que ya se guardaron
  const progress = useRef<{ key: string; stamp: number; done: number } | null>(null);

  const strength = types.includes('strength');
  const other = types.includes('sport');

  const toggleType = (id: WorkoutType) => {
    const on = types.includes(id);
    if (on && types.length === 1) return; // siempre queda uno
    setTypes(on ? types.filter((x) => x !== id) : [...types, id]);
    // Al marcar «Otro», la lista de deportes (si aún no hay ninguno elegido)
    if (!on && id === 'sport' && !sport) setPicking(true);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setFailed(false);
    const base = Math.floor(minutes / types.length);
    const chosen = sportToSave(sport, sportText);
    // Reintentar lo mismo sigue donde se quedó; si se ha cambiado algo, es otro entreno
    const key = JSON.stringify([types, minutes, intensity, chosen]);
    const run = progress.current?.key === key ? progress.current : { key, stamp: Date.now(), done: 0 };
    progress.current = run;
    const now = new Date(run.stamp).toISOString();
    try {
      for (const [i, type] of types.entries()) {
        if (i < run.done) continue;
        // El resto de la división va al primero: 45 min en 2 tipos = 23 + 22
        const share = base + (i === 0 ? minutes - base * types.length : 0);
        await workoutRepository.save({
          id: `workout-${run.stamp}-${i}`,
          fecha: now,
          createdAt: now,
          type,
          minutes: share,
          intensity,
          ...(type === 'sport' && chosen ? { sport: chosen } : {}),
        });
        run.done = i + 1;
      }
      // Si la cuenta de la semana no se puede leer, al menos la que se acaba de guardar
      setSavedCount(await strengthSessionsThisWeek().catch(() => (types.includes('strength') ? 1 : 0)));
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  if (savedCount !== null) {
    const goalHit = strength && savedCount >= 3;
    const tone = goalHit ? FINE.gold : FINE.jade;
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        {/* El aro: las sesiones de fuerza de la semana sobre 3 (con otro tipo, cerrado). Dentro, el dibujo del tipo:
            con fuerza, las pesas de toda la app */}
        <View style={styles.doneIcon}>
          <GlowRing progress={strength ? Math.min(1, savedCount / 3) : 1} colors={ringTones(tone)} size={112} stroke={5}>
            <WorkoutTypeIcon type={strength ? 'strength' : types[0]} size={40} color={tone} />
          </GlowRing>
        </View>
        <Text style={styles.doneTitle}>{goalHit ? tr('Weekly goal reached!') : tr('Workout logged!')}</Text>
        <Text style={styles.doneText}>
          {strength ? tr('{n} of 3 strength sessions this week.', { n: savedCount }) : tr('Nice. Every bit of movement counts.')}
        </Text>
        <FineButton label={tr('Done')} onPress={() => router.back()} style={styles.doneButton} />
      </SafeAreaView>
    );
  }

  const chosenName = sport === OTHER_SPORT ? tr('Other') : sportName(sport);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title={tr('Log a workout')} right={<CloseButton onPress={() => router.back()} />} />

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <SecRow title={tr('Type')} right={<Text style={styles.secNote}>{tr('Choose one or more')}</Text>} style={styles.firstHead} />
        {TYPES.map((x, i) => {
          const on = types.includes(x.id);
          return (
            <FOption
              key={x.id}
              title={tr(x.label)}
              hint={tr(x.hint)}
              on={on}
              multi
              onPress={() => toggleType(x.id)}
              left={<PathEmblem d={workoutTypePath(x.id)} size={EMBLEM} color={on ? FINE.jade : FINE.mute} />}
              last={i === TYPES.length - 1}
            />
          );
        })}

        {/* Con «Otro»: qué deporte, pegado a su fila (sin línea entre las dos). La fila abre la lista; con «Otro» de
            la lista, se escribe el nombre */}
        {other && (
          <View style={styles.sport}>
            <TouchableOpacity
              style={[fine.row, styles.sportRow]}
              onPress={() => setPicking(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${tr('Sport or activity')}: ${chosenName ?? tr('Choose one')}`}
            >
              <Text style={[fine.rowTitle, styles.flex]}>{tr('Sport or activity')}</Text>
              <Text style={[fine.rowValue, !chosenName && styles.placeholder]} numberOfLines={1}>
                {chosenName ?? tr('Choose one')}
              </Text>
              <Ionicons name="chevron-down" size={15} color={FINE.mute} />
            </TouchableOpacity>
            {sport === OTHER_SPORT && (
              <TextInput
                style={[formStyles.input, styles.sportInput]}
                value={sportText}
                onChangeText={setSportText}
                placeholder={tr('Write which one')}
                placeholderTextColor={FINE.mute}
                maxLength={SPORT_NAME_MAX}
                autoCapitalize="sentences"
                returnKeyType="done"
                accessibilityLabel={tr('Name of the sport or activity')}
              />
            )}
          </View>
        )}

        <SecHead title={tr('Duration')} />
        <FineNumber
          value={minutes}
          onChange={setMinutes}
          min={5}
          max={MAX_MINUTES}
          step={5}
          fastStep={15}
          unit="min"
          label={tr('Duration')}
          compact
          onValidChange={numbers.watch('minutes')}
          style={styles.number}
        />

        <SecHead title={tr('Intensity')} />
        <FChips options={INTENSITIES.map((x) => ({ id: x.id, label: tr(x.label) }))} value={intensity} onChange={setIntensity} style={styles.chips} />
      </KeyboardAwareScrollView>

      <KeyboardFooter>
        <View style={measureStyles.footer}>
          {failed && <Text style={styles.failed}>{tr('The workout could not be saved. Check your connection and try again.')}</Text>}
          <FineButton label={failed ? tr('Try again') : tr('Save workout')} onPress={save} disabled={saving || !numbers.ready} />
        </View>
      </KeyboardFooter>

      {/* La lista de deportes, en una hoja: filas con línea fina y el círculo de elegido a la derecha */}
      <WorkoutModal visible={picking} title={tr('Sport or activity')} onClose={() => setPicking(false)}>
        <View accessibilityRole="radiogroup">
          {sportOptions().map((s, i, all) => (
            <FOption
              key={s.id}
              title={s.label}
              on={sport === s.id}
              last={i === all.length - 1}
              onPress={() => {
                setSport(s.id);
                setPicking(false);
              }}
            />
          ))}
        </View>
      </WorkoutModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  centered: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  flex: { flex: 1 },
  // flexGrow: la ScrollView ocupa todo el hueco, así que tocar fuera de una casilla cierra el teclado
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  firstHead: { marginTop: 4 },
  secNote: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  // Lo de «Otro», debajo de su fila y alineado con su nombre (pasado el aro)
  sport: { marginLeft: EMBLEM + 10 },
  sportRow: { borderBottomWidth: 0 },
  placeholder: { color: FINE.mute },
  sportInput: { marginTop: 2, marginBottom: 6 },
  number: { marginTop: 14, marginBottom: 2 },
  chips: { marginTop: 8 },
  failed: { ...formStyles.error, textAlign: 'center', marginBottom: 10 },
  doneIcon: { marginBottom: 20 },
  doneTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 26, lineHeight: 32, marginBottom: 8, textAlign: 'center' },
  doneText: { ...ff('regular'), color: FINE.mute, fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  doneButton: { alignSelf: 'stretch' },
});
