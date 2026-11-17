import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { ChoiceChips } from '@/components/ChoiceChips';
import { BristolRuler, StoolColorPicker } from '@/components/BathroomVisuals';
import { DayCountStepper, VisitsSection } from '@/components/BathroomVisits';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SecHead } from '@/components/fine/Fine';
import { CheckRow, CloseButton, FineButton, measureStyles } from '@/components/fine/FineMeasure';
import { formStyles } from '@/components/fine/FineForm';
import { bowelRepository, dayKey, entryForDay, noonOf } from '@/data/bathroomRepository';
import { BowelEntry, BowelMovement, BristolType, STOOL_COLORS, StoolColor } from '@/types/bathroom';
import { t as tr } from '@/i18n';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { KeyboardFooter } from '@/components/KeyboardFooter';
import { FINE, ff, fine } from '@/theme/fine';

// Lo que suele explicar un color llamativo: se pregunta antes de recomendar el médico
const CAUSES: Partial<Record<StoolColor, string[]>> = {
  red: ['Beetroot', 'Red dragon fruit', 'Tomato or tomato sauce', 'Red drinks or sweets', 'Cranberries'],
  black: ['Iron supplements', 'Bismuth (e.g. Pepto-Bismol)', 'Black liquorice', 'Lots of blueberries'],
};
const NONE = 'None of these';

// Apunte del día: cuántas veces (con − y +), cada vez suelta con su hora (BathroomVisits), color,
// consistencia y notas. Si ya existe, se edita.
// Con ?quick=1, "una vez, ahora": solo color y consistencia, y se suma una vez al día de hoy.
// Desde el 2026-11-16, en el lenguaje fino del prototipo (como LogWeightScreen y LogDigestionScreen): título a la
// izquierda con la × de cerrar, sin icono en círculo de color, cabeceras de sección pequeñas con su raya, las
// formas de Bristol en filas con línea fina y el círculo de marcar, y un solo botón de Guardar abajo (antes, el ✓
// de arriba). Tono neutro: jade si algo lo explica, oro para «coméntalo con un médico» y ámbar solo para «ve al
// médico».
// Desde el 2026-11-17 (fundador: «la misma estética que la orina, con un continuo de color sin tantos nombres, no
// como ahora con circulitos… 2 líneas: una para la escala de marrones y otra para los demás colores. Consistencia
// me pregunto si se puede mejorar»): el color, en dos reglas como la de la orina (StoolColorPicker) y la
// consistencia, en una regla de muy dura a líquida con el dibujo a línea del tipo elegido (BristolRuler), en vez
// de los círculos con nombre y de las siete filas. Se guarda lo mismo que antes.
export const LogBowelScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string; quick?: string }>();
  const quick = params.quick === '1';
  const day = quick ? dayKey(new Date()) : (params.day ?? dayKey(new Date()));
  const [existing, setExisting] = useState<BowelEntry | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [visits, setVisits] = useState<BowelMovement[]>([]);
  const [color, setColor] = useState<StoolColor | undefined>();
  const [consistency, setConsistency] = useState<BristolType | undefined>();
  const [cause, setCause] = useState<string | undefined>();
  const [note, setNote] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    bowelRepository.getAll().then((all) => {
      const e = entryForDay(all, day);
      if (!e) return;
      setExisting(e);
      if (quick) return; // una vez más: lo de esta vez empieza en blanco
      setCount(e.count);
      setVisits(e.movements ?? []);
      setColor(e.color);
      setConsistency(e.consistency);
      setCause(e.explainedBy);
      setNote(e.note ?? '');
    });
  }, [day, quick]);
  // En "una vez, ahora" las veces son las que ya había hoy + esta
  const total = quick ? (existing?.count ?? 0) + 1 : count;

  const flag = STOOL_COLORS.find((c) => c.id === color)?.flag;
  const causes = color ? CAUSES[color] : undefined;

  const save = async () => {
    if (total == null) return;
    setSaving(true);
    const values: Partial<BowelEntry> = quick
      ? {
          count: total,
          // El color y la forma de esta vez pasan a ser los del día (los últimos)
          ...(color ? { color, explainedBy: cause && cause !== NONE ? cause : undefined } : {}),
          ...(consistency ? { consistency } : {}),
          // Y su hora, para cruzarla con las comidas (src/logic/gutPatterns.ts)
          movements: [...(existing?.movements ?? []), { at: new Date().toISOString(), consistency, color, urgent: urgent || undefined }],
        }
      : {
          count: total,
          movements: visits,
          color: total > 0 ? color : undefined,
          consistency: total > 0 ? consistency : undefined,
          explainedBy: total > 0 && cause && cause !== NONE ? cause : undefined,
          note: note.trim() || undefined,
        };
    try {
      if (existing) await bowelRepository.update(existing.id, values);
      else await bowelRepository.save({ id: `${Date.now()}`, fecha: noonOf(day), createdAt: new Date().toISOString(), count: total, ...values });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  // Color y consistencia: en «una vez, ahora» son las secciones de la pantalla; en el día van dentro de «El día
  // en general», con su nombre en pequeño
  const subHead = (title: string) => (quick ? <SecHead title={title} /> : <Text style={styles.subHead}>{title}</Text>);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title={quick ? tr('Just now') : tr('Your stools today')} right={<CloseButton onPress={() => router.back()} />} />

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>
          {quick
            ? tr('It adds one time to today ({n} so far). Colour and shape are optional.', { n: existing?.count ?? 0 })
            : tr('Takes 10 seconds. It helps us spot changes early, and nobody else sees it.')}
        </Text>

        {!quick && (
          <>
            <SecHead title={tr('How many times did you go today?')} />
            <DayCountStepper count={count} min={visits.length} max={20} onChange={setCount} />
            <VisitsSection
              kind="bowel"
              day={day}
              visits={visits}
              max={20}
              onChange={(next, saved) => {
                setVisits(next as BowelMovement[]);
                setCount((c) => Math.max(c ?? 0, next.length));
                // Lo de la última vez pasa al día, como en «una vez, ahora» (y así sale la pregunta del color)
                if (saved?.color) {
                  setColor(saved.color as StoolColor);
                  setCause(undefined);
                }
                if (saved?.consistency) setConsistency(saved.consistency);
              }}
            />
            {total != null && total > 0 && <SecHead title={tr('The day in general')} />}
          </>
        )}

        {total != null && total > 0 && (
          <>
            {subHead(tr('Colour'))}
            <StoolColorPicker value={color} onChange={(c) => { setColor(c); setCause(undefined); }} />

            {/* Un color llamativo: antes que el médico, se pregunta por lo que suele explicarlo */}
            {causes && (
              <View style={styles.ask}>
                <Text style={fine.rowTitle}>{tr('Could something explain it?')}</Text>
                <Text style={styles.askText}>{tr('In the last two days, did you have any of these?')}</Text>
                <ChoiceChips options={[...causes, NONE].map((c) => ({ id: c, label: tr(c) }))} value={cause} onChange={setCause} />
                {cause === NONE && (
                  <Text style={styles.askDoctor}>
                    {color === 'black'
                      ? tr('Please see a doctor soon. If you also feel dizzy or weak, get urgent help.')
                      : tr('Please talk to a doctor in the next few days. Get urgent help if there is a lot of blood.')}
                  </Text>
                )}
                {cause && cause !== NONE && (
                  <Text style={styles.askOk}>
                    {tr('That is the most likely reason. It should look normal again within a day or two. Keep an eye on it and, if you have any doubt, see a doctor.')}
                  </Text>
                )}
              </View>
            )}
            {flag === 'doctor' && (
              <Text style={[formStyles.warn, styles.flagNote]}>
                {tr('Pale or clay-coloured stools are worth mentioning to a doctor, especially if they happen more than once.')}
              </Text>
            )}

            {subHead(tr('Consistency'))}
            <BristolRuler value={consistency} onChange={setConsistency} />
            {quick && <CheckRow label={tr('I had to rush (urgency)')} on={urgent} onPress={() => setUrgent(!urgent)} style={styles.rushRow} />}
          </>
        )}

        {!quick && (
          <>
            <SecHead title={tr('Anything else? (optional)')} />
            <TextInput
              style={measureStyles.input}
              value={note}
              onChangeText={setNote}
              placeholder={tr('Travelling, new food, tummy ache…')}
              placeholderTextColor={FINE.mute}
              multiline
              accessibilityLabel={tr('Anything else? (optional)')}
            />
          </>
        )}
      </KeyboardAwareScrollView>

      <KeyboardFooter>
        <View style={measureStyles.footer}>
          <FineButton label={tr('Save')} onPress={save} disabled={saving || total == null} />
        </View>
      </KeyboardFooter>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  lead: { ...fine.note, marginTop: 0 },
  // El nombre de cada parte dentro de «El día en general»
  subHead: { ...ff('medium'), fontSize: 15, color: FINE.ivory, marginTop: 18, marginBottom: 12 },
  // La pregunta de un color llamativo: tarjeta casi transparente, sin color de alarma
  ask: { ...fine.tile, padding: 14, marginTop: 16, gap: 8 },
  askText: { ...fine.note, marginTop: 0, marginBottom: 2 },
  // Solo «ve al médico» va en ámbar; si algo lo explica, en jade
  askDoctor: { ...ff('medium'), color: Colors.attention, fontSize: 13, lineHeight: 19, marginTop: 2 },
  askOk: { ...ff('regular'), color: FINE.jade, fontSize: 13, lineHeight: 19, marginTop: 2 },
  flagNote: { marginTop: 14 },
  // «Tuve que ir corriendo», entre dos rayas finas bajo la regla de la consistencia
  rushRow: { marginTop: 18, borderTopWidth: 1, borderTopColor: FINE.line },
});
