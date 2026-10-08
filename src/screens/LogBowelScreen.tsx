import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { ChoiceChips } from '@/components/ChoiceChips';
import { BristolShape, ColorSwatches } from '@/components/BathroomVisuals';
import { bowelRepository, dayKey, entryForDay, noonOf } from '@/data/bathroomRepository';
import { BowelEntry, BRISTOL_TYPES, BristolType, STOOL_COLORS, StoolColor } from '@/types/bathroom';

// Lo que suele explicar un color llamativo: se pregunta antes de recomendar el médico
const CAUSES: Partial<Record<StoolColor, string[]>> = {
  red: ['Beetroot', 'Red dragon fruit', 'Tomato or tomato sauce', 'Red drinks or sweets', 'Cranberries'],
  black: ['Iron supplements', 'Bismuth (e.g. Pepto-Bismol)', 'Black liquorice', 'Lots of blueberries'],
};
const NONE = 'None of these';

const COUNTS = [0, 1, 2, 3, 4].map((n) => ({ id: n, label: n === 4 ? '4+' : String(n) }));

// Apunte del día: cuántas veces, color, consistencia y notas. Si ya existe, se edita.
export const LogBowelScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string }>();
  const day = params.day ?? dayKey(new Date());
  const [existing, setExisting] = useState<BowelEntry | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [color, setColor] = useState<StoolColor | undefined>();
  const [consistency, setConsistency] = useState<BristolType | undefined>();
  const [cause, setCause] = useState<string | undefined>();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    bowelRepository.getAll().then((all) => {
      const e = entryForDay(all, day);
      if (!e) return;
      setExisting(e);
      setCount(e.count);
      setColor(e.color);
      setConsistency(e.consistency);
      setCause(e.explainedBy);
      setNote(e.note ?? '');
    });
  }, [day]);

  const flag = STOOL_COLORS.find((c) => c.id === color)?.flag;
  const causes = color ? CAUSES[color] : undefined;

  const save = async () => {
    if (count == null) return;
    setSaving(true);
    const values: Partial<BowelEntry> = {
      count,
      color: count > 0 ? color : undefined,
      consistency: count > 0 ? consistency : undefined,
      explainedBy: count > 0 && cause && cause !== NONE ? cause : undefined,
      note: note.trim() || undefined,
    };
    try {
      if (existing) await bowelRepository.update(existing.id, values);
      else await bowelRepository.save({ id: `${Date.now()}`, fecha: noonOf(day), createdAt: new Date().toISOString(), count, ...values });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.circleButton, count != null && styles.circleButtonActive]}
          onPress={save}
          disabled={saving || count == null}
        >
          <Ionicons name="checkmark" size={22} color={count != null ? Colors.background : Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <MaterialCommunityIcons name="stomach" size={26} color={Colors.green} />
          </View>
          <Text style={styles.title}>Digestion today</Text>
          <Text style={styles.subtitle}>Takes 10 seconds. It helps us spot changes early, and nobody else sees it.</Text>
        </View>

        <Text style={styles.label}>How many times did you go today?</Text>
        <ChoiceChips options={COUNTS} value={count} onChange={setCount} />

        {count != null && count > 0 && (
          <>
            <Text style={styles.label}>Colour</Text>
            <ColorSwatches options={STOOL_COLORS} value={color} onChange={(c) => { setColor(c); setCause(undefined); }} />

            {causes && (
              <View style={styles.askCard}>
                <Text style={styles.askTitle}>Could something explain it?</Text>
                <Text style={styles.askText}>In the last two days, did you have any of these?</Text>
                <ChoiceChips options={[...causes, NONE].map((c) => ({ id: c, label: c }))} value={cause} onChange={setCause} />
                {cause === NONE && (
                  <Text style={styles.askAdvice}>
                    {color === 'black'
                      ? 'Please see a doctor soon. If you also feel dizzy or weak, get urgent help.'
                      : 'Please talk to a doctor in the next few days. Get urgent help if there is a lot of blood.'}
                  </Text>
                )}
                {cause && cause !== NONE && (
                  <Text style={styles.askOk}>That is the most likely reason. It should look normal again within a day or two.</Text>
                )}
              </View>
            )}
            {flag === 'doctor' && (
              <View style={styles.askCard}>
                <Text style={styles.askText}>
                  Pale or clay-coloured stools are worth mentioning to a doctor, especially if they happen more than once.
                </Text>
              </View>
            )}

            <Text style={styles.label}>Consistency</Text>
            <View style={styles.types}>
              {BRISTOL_TYPES.map((t) => {
                const selected = consistency === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.typeCard, selected && styles.typeCardSelected]}
                    onPress={() => setConsistency(t.id)}
                    activeOpacity={0.85}
                  >
                    <BristolShape type={t.id} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.typeTitle}>{t.label}</Text>
                      <Text style={styles.typeHint}>{t.hint}</Text>
                    </View>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? Colors.accent : Colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.label}>Anything else? (optional)</Text>
        <TextInput
          style={styles.note}
          value={note}
          onChangeText={setNote}
          placeholder="Travelling, new food, tummy ache…"
          placeholderTextColor={Colors.textMuted}
          multiline
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export const logScreenStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleButtonActive: { backgroundColor: Colors.accent },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginTop: 8, marginBottom: 8 },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  label: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 22, marginBottom: 10 },
  askCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    gap: 8,
  },
  askTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  askText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  askAdvice: { color: Colors.attention, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  askOk: { color: Colors.ok, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  note: {
    minHeight: 70,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 12,
    color: Colors.textPrimary,
    fontSize: 14,
    textAlignVertical: 'top',
  },
});

const styles = StyleSheet.create({
  ...logScreenStyles,
  types: { gap: 8 },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  typeCardSelected: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  typeTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  typeHint: { color: Colors.textSecondary, fontSize: 12, marginTop: 1 },
});
