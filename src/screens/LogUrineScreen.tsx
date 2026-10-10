import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { ChoiceChips } from '@/components/ChoiceChips';
import { ColorSwatches } from '@/components/BathroomVisuals';
import { dayKey, entryForDay, noonOf, urineRepository } from '@/data/bathroomRepository';
import { dailyTotalNote, urineAdvice, UrineAdvice, volumeCheckSuggestion, VolumeCheckSuggestion } from '@/logic/bathroom';
import { UrineColor, UrineEntry, URINE_COLORS, VOID_VOLUMES, VoidVolume } from '@/types/bathroom';
import { logScreenStyles } from './LogBowelScreen';
import { t } from '@/i18n';

const RED_CAUSES = ['Beetroot', 'Blackberries', 'Rhubarb', 'A new medicine'];
const NONE = 'None of these';
const NIGHTS = [0, 1, 2, 3].map((n) => ({ id: n, label: n === 3 ? '3+' : String(n) }));

// Apunte del día: veces, por la noche, color y escozor. Y, de vez en cuando, la prueba de la
// botella para tener una idea del volumen (primera vez, cada 3 meses o si algo cambia).
export const LogUrineScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string; volume?: string }>();
  const day = params.day ?? dayKey(new Date());
  const [existing, setExisting] = useState<UrineEntry | null>(null);
  const [suggestion, setSuggestion] = useState<VolumeCheckSuggestion>(null);
  const [count, setCount] = useState(6);
  const [nightCount, setNightCount] = useState<number | undefined>();
  const [color, setColor] = useState<UrineColor | undefined>();
  const [cause, setCause] = useState<string | undefined>();
  const [burning, setBurning] = useState<'yes' | 'no' | undefined>();
  const [showVolume, setShowVolume] = useState(params.volume === '1');
  const [voidVolume, setVoidVolume] = useState<VoidVolume | undefined>();
  const [volumeUsual, setVolumeUsual] = useState<UrineEntry['volumeUsual']>();
  const [total, setTotal] = useState('');
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
      if (e.count != null) setCount(e.count);
      setNightCount(e.nightCount);
      setColor(e.color);
      setCause(e.explainedBy);
      setBurning(e.burning == null ? undefined : e.burning ? 'yes' : 'no');
      setVoidVolume(e.voidVolume);
      setVolumeUsual(e.volumeUsual);
      setTotal(e.dailyTotalMl ? String(e.dailyTotalMl) : '');
      setNote(e.note ?? '');
      if (e.voidVolume || e.dailyTotalMl) setShowVolume(true);
    });
  }, [day]);

  const totalMl = Number(total.replace(/[^\d]/g, '')) || undefined;

  const save = async () => {
    setSaving(true);
    const values: Partial<UrineEntry> = {
      count,
      nightCount,
      color,
      explainedBy: color === 'red' && cause && cause !== NONE ? cause : undefined,
      burning: burning == null ? undefined : burning === 'yes',
      voidVolume,
      volumeUsual: voidVolume ? volumeUsual : undefined,
      dailyTotalMl: totalMl,
      note: note.trim() || undefined,
    };
    try {
      if (existing) await urineRepository.update(existing.id, values);
      else await urineRepository.save({ id: `${Date.now()}`, fecha: noonOf(day), createdAt: new Date().toISOString(), ...values });
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
        ? `Your last volume check was ${suggestion.daysSince} days ago.`
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

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Ionicons name="water-outline" size={26} color={Colors.green} />
          </View>
          <Text style={styles.title}>{t('Urine today')}</Text>
          <Text style={styles.subtitle}>{t('Colour and how often say a lot about how hydrated you are.')}</Text>
        </View>

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

        <Text style={styles.label}>{t('Colour')}</Text>
        <ColorSwatches options={URINE_COLORS} value={color} onChange={(c) => { setColor(c); setCause(undefined); }} center />
        {color === 'red' && (
          <View style={styles.askCard}>
            <Text style={styles.askTitle}>{t('Could something explain it?')}</Text>
            <ChoiceChips options={[...RED_CAUSES, NONE].map((c) => ({ id: c, label: c }))} value={cause} onChange={setCause} />
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
        <ChoiceChips options={[{ id: 'no', label: 'No' }, { id: 'yes', label: 'Yes' }]} value={burning} onChange={setBurning} center />

        {/* Prueba de volumen */}
        <TouchableOpacity style={styles.volumeHeader} onPress={() => setShowVolume((v) => !v)} activeOpacity={0.85}>
          <View style={{ flex: 1 }}>
            <Text style={styles.volumeTitle}>{t('Quick volume check')}</Text>
            <Text style={styles.volumeSub}>{suggestionText ?? t('Optional, every few months.')}</Text>
          </View>
          <Ionicons name={showVolume ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} />
        </TouchableOpacity>
        {showVolume && (
          <View style={styles.askCard}>
            <Text style={styles.askText}>
              {t('Next time you go, pee into an empty 500 ml bottle or a measuring jug. How full was it?')}
            </Text>
            <ChoiceChips options={VOID_VOLUMES.map((v) => ({ id: v.id, label: v.label }))} value={voidVolume} onChange={setVoidVolume} />
            {voidVolume && (
              <>
                <Text style={styles.askTitle}>{t('Is that about what you usually pass?')}</Text>
                <ChoiceChips
                  options={[
                    { id: 'yes', label: 'Yes' },
                    { id: 'no', label: 'No' },
                    { id: 'unsure', label: 'Not sure' },
                  ]}
                  value={volumeUsual}
                  onChange={(v) => setVolumeUsual(v as UrineEntry['volumeUsual'])}
                />
                {volumeUsual === 'no' && (
                  <Text style={styles.askText}>{t('Try again another day. Most adults pass about 200–400 ml each time.')}</Text>
                )}
              </>
            )}
            <Text style={[styles.askTitle, { marginTop: 6 }]}>{t('Measured a whole day? (optional)')}</Text>
            <Text style={styles.askText}>
              {t('Pharmacies sell 24-hour urine containers. Collect everything for a day and write the total.')}
            </Text>
            <TextInput
              style={styles.input}
              value={total}
              onChangeText={setTotal}
              keyboardType="number-pad"
              placeholder={t('Total in ml, e.g. 1500')}
              placeholderTextColor={Colors.textMuted}
            />
            {totalMl ? <Text style={styles.askText}>{dailyTotalNote(totalMl).body}</Text> : null}
          </View>
        )}

        <Text style={styles.label}>{t('Anything else? (optional)')}</Text>
        <TextInput
          style={styles.note}
          value={note}
          onChangeText={setNote}
          placeholder={t('Drank less today, very hot, new medicine…')}
          placeholderTextColor={Colors.textMuted}
          multiline
        />
      </ScrollView>
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
