import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { ChoiceChips } from '@/components/ChoiceChips';
import { UrineColorPicker } from '@/components/BathroomVisuals';
import { DayCountStepper, VisitsSection } from '@/components/BathroomVisits';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FRow, SecHead } from '@/components/fine/Fine';
import { CloseButton, FineButton, FineLink, measureStyles } from '@/components/fine/FineMeasure';
import { formStyles } from '@/components/fine/FineForm';
import { dayKey, entryForDay, noonOf, urineRepository } from '@/data/bathroomRepository';
import { urineAdvice, UrineAdvice, volumeCheckSuggestion, VolumeCheckSuggestion } from '@/logic/bathroom';
import { UrineColor, UrineEntry, UrineVisit, URINE_COLORS, VOID_VOLUMES } from '@/types/bathroom';
import { t } from '@/i18n';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { KeyboardFooter } from '@/components/KeyboardFooter';
import { FINE, ff, fine } from '@/theme/fine';

const RED_CAUSES = ['Beetroot', 'Blackberries', 'Rhubarb', 'A new medicine'];
const NONE = 'None of these';
const NIGHTS = [0, 1, 2, 3].map((n) => ({ id: n, label: n === 3 ? '3+' : String(n) }));

// Apunte del día: veces (con − y +), cada vez suelta con su hora (BathroomVisits), por la noche, color y
// escozor. La medición rápida de volumen tiene su propia pantalla (/volume-check, con el vaso
// graduado); desde aquí solo se enlaza.
// Con ?quick=1, "una vez, ahora": color y escozor de esta vez, y se suma una vez al día de hoy.
// Desde el 2026-11-16, en el lenguaje fino del prototipo (como Heces y LogWeightScreen): título con la × de
// cerrar, sin icono en círculo de color, cabeceras de sección pequeñas, chips con borde, la medición de volumen en
// una fila con línea fina y un solo botón de Guardar abajo. El aviso tras guardar, con un icono a línea: oro para
// lo que conviene mirar y ámbar solo para «ve al médico».
export const LogUrineScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string; quick?: string }>();
  const quick = params.quick === '1';
  const day = quick ? dayKey(new Date()) : (params.day ?? dayKey(new Date()));
  const [existing, setExisting] = useState<UrineEntry | null>(null);
  const [suggestion, setSuggestion] = useState<VolumeCheckSuggestion>(null);
  const [count, setCount] = useState(6);
  const [visits, setVisits] = useState<UrineVisit[]>([]);
  const [nightCount, setNightCount] = useState<number | undefined>();
  const [color, setColor] = useState<UrineColor | undefined>();
  const [cause, setCause] = useState<string | undefined>();
  const [burning, setBurning] = useState<'yes' | 'no' | undefined>();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  // Tras guardar: si el color o las veces dicen algo (p. ej. que le falta agua), se le cuenta
  // antes de cerrar en vez de guardarlo sin más
  const [advice, setAdvice] = useState<UrineAdvice | null>(null);

  useEffect(() => {
    urineRepository.getAll().then((all) => {
      setSuggestion(volumeCheckSuggestion(all));
      const e = entryForDay(all, day);
      if (!e) return;
      setExisting(e);
      if (quick) return; // una vez más: lo de esta vez empieza en blanco
      if (e.count != null) setCount(e.count);
      setVisits(e.visits ?? []);
      setNightCount(e.nightCount);
      setColor(e.color);
      setCause(e.explainedBy);
      setBurning(e.burning == null ? undefined : e.burning ? 'yes' : 'no');
      setNote(e.note ?? '');
    });
  }, [day, quick]);

  const save = async () => {
    setSaving(true);
    const values: Partial<UrineEntry> = quick
      ? {
          count: (existing?.count ?? 0) + 1,
          visits: [...(existing?.visits ?? []), { at: new Date().toISOString(), color, burning: burning == null ? undefined : burning === 'yes' }],
          // El color de esta vez pasa a ser el del día (el último); el escozor, si lo hay, se queda
          ...(color ? { color, explainedBy: color === 'red' && cause && cause !== NONE ? cause : undefined } : {}),
          ...(burning === 'yes' ? { burning: true } : burning === 'no' && existing?.burning == null ? { burning: false } : {}),
        }
      : {
      count,
      visits,
      nightCount,
      color,
      explainedBy: color === 'red' && cause && cause !== NONE ? cause : undefined,
      burning: burning == null ? undefined : burning === 'yes',
      note: note.trim() || undefined,
    };
    try {
      if (existing) await urineRepository.update(existing.id, values);
      else await urineRepository.save({ id: `${Date.now()}`, fecha: noonOf(day), createdAt: new Date().toISOString(), ...values });
      // Solo por el color y el escozor: las veces del día no dan aviso
      const a = urineAdvice(values);
      if (a) setAdvice(a);
      else router.back();
    } finally {
      setSaving(false);
    }
  };

  const suggestionText =
    suggestion?.kind === 'first'
      ? t('You have not done a volume check yet. It takes one pee and a bottle.')
      : suggestion?.kind === 'periodic'
        ? t('Your last volume check was {n} days ago.', { n: suggestion.daysSince })
        : suggestion?.kind === 'repeat'
          ? t('Last time the amount did not feel usual. Try it again on a normal day.')
          : suggestion?.kind === 'collect_24h'
            ? t('It still did not feel usual. Pharmacies sell 24-hour urine containers (2–3 litres) so you can measure a whole day.')
            : null;

  // Lo que se le cuenta tras guardar: un icono a línea, sin círculo de color. Ámbar solo si es para ir al médico
  if (advice) {
    const doctor = advice.level === 'see_doctor';
    const tone = doctor ? Colors.attention : FINE.gold;
    return (
      <SafeAreaView style={[styles.safeArea, styles.adviceScreen]}>
        <Ionicons name={doctor ? 'medkit-outline' : 'water-outline'} size={30} color={tone} />
        <Text style={styles.savedText}>{t('Saved')}</Text>
        <Text style={styles.adviceTitle} accessibilityRole="header">
          {advice.title}
        </Text>
        <Text style={styles.adviceBody}>{advice.body}</Text>
        {doctor && <FineLink label={t('Find a doctor')} onPress={() => router.replace({ pathname: '/professionals', params: { role: 'doctor' } })} />}
        <FineButton label={t('Got it')} onPress={() => router.back()} style={styles.adviceButton} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title={quick ? t('Just now') : t('Urine today')} right={<CloseButton onPress={() => router.back()} />} />

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>
          {quick
            ? t('It adds one time to today ({n} so far). The colour is optional.', { n: existing?.count ?? 0 })
            : t('Colour and how often say a lot about how hydrated you are.')}
        </Text>

        {!quick && (
          <>
            <SecHead title={t('How many times today?')} />
            <DayCountStepper count={count} min={visits.length} max={30} onChange={setCount} />

            <VisitsSection
              kind="urine"
              day={day}
              visits={visits}
              max={30}
              onChange={(next, saved) => {
                setVisits(next as UrineVisit[]);
                setCount((c) => Math.max(c, next.length));
                // Lo de la última vez pasa al día, como en «una vez, ahora» (y así sale la pregunta del color)
                if (saved?.color) {
                  setColor(saved.color as UrineColor);
                  setCause(undefined);
                }
                if (saved?.burning) setBurning('yes');
              }}
            />

            <SecHead title={t('Times you woke up at night to go')} />
            <ChoiceChips options={NIGHTS} value={nightCount} onChange={setNightCount} />

            <SecHead title={t('The day in general')} />
          </>
        )}

        {quick ? <SecHead title={t('Colour')} /> : <Text style={styles.subHead}>{t('Colour')}</Text>}
        <UrineColorPicker options={URINE_COLORS} value={color} onChange={(c) => { setColor(c); setCause(undefined); }} />
        {/* Rosa o rojo: antes que el médico, se pregunta por lo que suele explicarlo */}
        {color === 'red' && (
          <View style={styles.ask}>
            <Text style={fine.rowTitle}>{t('Could something explain it?')}</Text>
            <ChoiceChips options={[...RED_CAUSES, NONE].map((c) => ({ id: c, label: t(c) }))} value={cause} onChange={setCause} />
            {cause === NONE && <Text style={styles.askDoctor}>{t('Blood in the urine always needs checking: please see a doctor soon.')}</Text>}
            {cause && cause !== NONE && (
              <Text style={styles.askOk}>
                {t('That is the likely cause. It should clear within a day. Keep an eye on it and, if you have any doubt, see a doctor.')}
              </Text>
            )}
          </View>
        )}
        {color === 'brown' && (
          <Text style={[formStyles.warn, styles.flagNote]}>{t('If it does not clear with more water, brown urine is worth checking with a doctor.')}</Text>
        )}

        {quick ? <SecHead title={t('Any burning or pain?')} /> : <Text style={styles.subHead}>{t('Any burning or pain?')}</Text>}
        <ChoiceChips options={[{ id: 'no', label: t('No') }, { id: 'yes', label: t('Yes') }]} value={burning} onChange={setBurning} />

        {/* La medición rápida de volumen, en su propia pantalla */}
        {!quick && (
          <>
            <View style={styles.volumeRows}>
              <FRow
                title={t('Quick volume check')}
                sub={
                  existing?.voidMl
                    ? t('Done today: {n} ml', { n: existing.voidMl })
                    : existing?.voidVolume
                      ? t('Done today: about {n} ml', { n: VOID_VOLUMES.find((v) => v.id === existing.voidVolume)?.ml ?? '—' })
                      : suggestionText ?? t('Optional, every few months.')
                }
                onPress={() => router.push({ pathname: '/volume-check', params: { day } })}
                last
              />
            </View>

            <SecHead title={t('Anything else? (optional)')} />
            <TextInput
              style={measureStyles.input}
              value={note}
              onChangeText={setNote}
              placeholder={t('Drank less today, very hot, new medicine…')}
              placeholderTextColor={FINE.mute}
              multiline
              accessibilityLabel={t('Anything else? (optional)')}
            />
          </>
        )}
      </KeyboardAwareScrollView>

      <KeyboardFooter>
        <View style={measureStyles.footer}>
          <FineButton label={t('Save')} onPress={save} disabled={saving} />
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
  // La pregunta del rosa o rojo: tarjeta casi transparente, sin color de alarma
  ask: { ...fine.tile, padding: 14, marginTop: 16, gap: 10 },
  // Solo «ve al médico» va en ámbar; si algo lo explica, en jade
  askDoctor: { ...ff('medium'), color: Colors.attention, fontSize: 13, lineHeight: 19 },
  askOk: { ...ff('regular'), color: FINE.jade, fontSize: 13, lineHeight: 19 },
  flagNote: { marginTop: 14 },
  // La fila de la medición de volumen, entre dos rayas como una sección
  volumeRows: { marginTop: 24, borderTopWidth: 1, borderTopColor: FINE.rule },
  // El aviso tras guardar, centrado
  adviceScreen: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, gap: 10 },
  savedText: { ...fine.kicker, marginTop: 6 },
  adviceTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 22, lineHeight: 28, textAlign: 'center' },
  adviceBody: { ...measureStyles.p, textAlign: 'center' },
  adviceButton: { alignSelf: 'stretch', marginTop: 18 },
});
