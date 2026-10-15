import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { ChoiceChips } from '@/components/ChoiceChips';
import { ColorSwatches } from '@/components/BathroomVisuals';
import { dayKey, entryForDay, noonOf, urineRepository } from '@/data/bathroomRepository';
import { urineAdvice, UrineAdvice, volumeCheckSuggestion, VolumeCheckSuggestion } from '@/logic/bathroom';
import { UrineColor, UrineEntry, URINE_COLORS, VOID_VOLUMES } from '@/types/bathroom';
import { logScreenStyles } from './LogBowelScreen';
import { t } from '@/i18n';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';

const RED_CAUSES = ['Beetroot', 'Blackberries', 'Rhubarb', 'A new medicine'];
const NONE = 'None of these';
const NIGHTS = [0, 1, 2, 3].map((n) => ({ id: n, label: n === 3 ? '3+' : String(n) }));

// Apunte del día: veces, por la noche, color y escozor. La medición rápida de volumen tiene su
// propia pantalla (/volume-check, con el vaso graduado); desde aquí solo se enlaza.
// Con ?quick=1, "una vez, ahora": color y escozor de esta vez, y se suma una vez al día de hoy.
export const LogUrineScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string; quick?: string }>();
  const quick = params.quick === '1';
  const day = quick ? dayKey(new Date()) : (params.day ?? dayKey(new Date()));
  const [existing, setExisting] = useState<UrineEntry | null>(null);
  const [suggestion, setSuggestion] = useState<VolumeCheckSuggestion>(null);
  const [count, setCount] = useState(6);
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
          // El color de esta vez pasa a ser el del día (el último); el escozor, si lo hay, se queda
          ...(color ? { color, explainedBy: color === 'red' && cause && cause !== NONE ? cause : undefined } : {}),
          ...(burning === 'yes' ? { burning: true } : burning === 'no' && existing?.burning == null ? { burning: false } : {}),
        }
      : {
      count,
      nightCount,
      color,
      explainedBy: color === 'red' && cause && cause !== NONE ? cause : undefined,
      burning: burning == null ? undefined : burning === 'yes',
      note: note.trim() || undefined,
    };
    try {
      if (existing) await urineRepository.update(existing.id, values);
      else await urineRepository.save({ id: `${Date.now()}`, fecha: noonOf(day), createdAt: new Date().toISOString(), ...values });
      // Sobre la marcha, el día no ha terminado: el aviso de "pocas veces" no aplica (el color y el escozor, sí)
      const a = urineAdvice(quick ? { ...values, count: undefined } : values);
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

  if (advice) {
    const color = advice.level === 'tip' ? Colors.gold : Colors.attention;
    return (
      <SafeAreaView style={[styles.safeArea, styles.adviceScreen]}>
        <View style={[styles.adviceIcon, { backgroundColor: withAlpha(color, 0.16) }]}>
          <Ionicons name={advice.level === 'see_doctor' ? 'medkit-outline' : 'water'} size={30} color={color} />
        </View>
        <Text style={styles.savedText}>{t('Saved')}</Text>
        <Text style={styles.adviceTitle}>{advice.title}</Text>
        <Text style={styles.adviceBody}>{advice.body}</Text>
        {advice.level === 'see_doctor' && (
          <TouchableOpacity onPress={() => router.replace({ pathname: '/professionals', params: { role: 'doctor' } })}>
            <Text style={styles.adviceLink}>{t('Find a doctor')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.adviceButton} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={styles.adviceButtonText}>{t('Got it')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.circleButton, styles.circleButtonActive]} onPress={save} disabled={saving}>
          <Ionicons name="checkmark" size={22} color={Colors.background} />
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Ionicons name="water-outline" size={26} color={Colors.green} />
          </View>
          <Text style={styles.title}>{quick ? t('Just now') : t('Urine today')}</Text>
          <Text style={styles.subtitle}>
            {quick
              ? t('It adds one time to today ({n} so far). The colour is optional.', { n: existing?.count ?? 0 })
              : t('Colour and how often say a lot about how hydrated you are.')}
          </Text>
        </View>

        {!quick && (
        <>
        <Text style={styles.label}>{t('How many times today?')}</Text>
        <View style={[styles.stepper, styles.centered]}>
          <TouchableOpacity style={styles.stepButton} onPress={() => setCount((c) => Math.max(0, c - 1))}>
            <Ionicons name="remove" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.stepValue}>{count}</Text>
          <TouchableOpacity style={styles.stepButton} onPress={() => setCount((c) => Math.min(30, c + 1))}>
            <Ionicons name="add" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>{t('Times you woke up at night to go')}</Text>
        <ChoiceChips options={NIGHTS} value={nightCount} onChange={setNightCount} center />
        </>
        )}

        <Text style={styles.label}>{t('Colour')}</Text>
        <ColorSwatches options={URINE_COLORS} value={color} onChange={(c) => { setColor(c); setCause(undefined); }} center />
        {color === 'red' && (
          <View style={styles.askCard}>
            <Text style={styles.askTitle}>{t('Could something explain it?')}</Text>
            <ChoiceChips options={[...RED_CAUSES, NONE].map((c) => ({ id: c, label: t(c) }))} value={cause} onChange={setCause} />
            {cause === NONE && <Text style={styles.askAdvice}>{t('Blood in the urine always needs checking: please see a doctor soon.')}</Text>}
            {cause && cause !== NONE && (
              <Text style={styles.askOk}>
                {t('That is the likely cause. It should clear within a day. Keep an eye on it and, if you have any doubt, see a doctor.')}
              </Text>
            )}
          </View>
        )}
        {color === 'brown' && (
          <View style={styles.askCard}>
            <Text style={styles.askText}>{t('If it does not clear with more water, brown urine is worth checking with a doctor.')}</Text>
          </View>
        )}

        <Text style={styles.label}>{t('Any burning or pain?')}</Text>
        <ChoiceChips options={[{ id: 'no', label: t('No') }, { id: 'yes', label: t('Yes') }]} value={burning} onChange={setBurning} center />

        {/* La medición rápida de volumen, en su propia pantalla */}
        {!quick && (
        <>
        <TouchableOpacity
          style={styles.volumeHeader}
          onPress={() => router.push({ pathname: '/volume-check', params: { day } })}
          activeOpacity={0.85}
        >
          <Ionicons name="beaker-outline" size={22} color={Colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.volumeTitle}>{t('Quick volume check')}</Text>
            <Text style={styles.volumeSub}>
              {existing?.voidMl
                ? t('Done today: {n} ml', { n: existing.voidMl })
                : existing?.voidVolume
                  ? t('Done today: about {n} ml', { n: VOID_VOLUMES.find((v) => v.id === existing.voidVolume)?.ml ?? '—' })
                  : suggestionText ?? t('Optional, every few months.')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.label}>{t('Anything else? (optional)')}</Text>
        <TextInput
          style={styles.note}
          value={note}
          onChangeText={setNote}
          placeholder={t('Drank less today, very hot, new medicine…')}
          placeholderTextColor={Colors.textMuted}
          multiline
        />
        </>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  ...logScreenStyles,
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  centered: { justifyContent: 'center' },
  adviceScreen: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, gap: 10 },
  adviceIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  savedText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  adviceTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  adviceBody: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  adviceLink: { color: Colors.accent, fontSize: 14, fontWeight: '700', marginTop: 4 },
  adviceButton: {
    alignSelf: 'stretch',
    backgroundColor: Colors.accent,
    borderRadius: 26,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  adviceButtonText: { color: Colors.background, fontSize: 15, fontWeight: '700' },
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
  stepValue: { color: Colors.textPrimary, fontSize: 28, fontWeight: '800', minWidth: 40, textAlign: 'center' },
  volumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 14,
  },
  volumeTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  volumeSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    padding: 12,
    color: Colors.textPrimary,
    fontSize: 14,
  },
});
