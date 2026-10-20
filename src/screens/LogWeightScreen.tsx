import { dateLocale, getLang, num, t } from '@/i18n';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, withAlpha } from '@/constants/colors';
import { AppIcon } from '@/components/HealthIcons';
import { WheelPicker } from '@/components/WheelPicker';
import { profileRepository } from '@/data/profileRepository';
import { BodyComp, bodyCompFor, removeWeighIn, saveWeighIn, weightRepository } from '@/data/weightRepository';
import { BODY_COMP, BodyCompKind, parseComp, weighAdvice } from '@/logic/weight';
import { offerPhoneReminders } from '@/data/phoneReminders';

// Apuntar el peso (ruedas, como el resto de mediciones) y, si la báscula la da, la composición corporal
// a mano: grasa, agua, músculo y hueso. Con el aviso de que no hace falta pesarse a diario.

const MIN = 30;
const MAX = 250;
const COLOR = Colors.violet;
const formatDate = (date: Date) => date.toLocaleDateString(dateLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
const formatTime = (date: Date) => date.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

export const LogWeightScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [dateTime, setDateTime] = useState(new Date());
  const WHOLE = Array.from({ length: MAX - MIN + 1 }, (_, i) => String(MIN + i));
  const DEC = Array.from({ length: 10 }, (_, i) => String(i));
  const [whole, setWhole] = useState(70 - MIN);
  const [dec, setDec] = useState(0);
  const [wheelKey, setWheelKey] = useState(0);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [comp, setComp] = useState<Record<BodyCompKind, string>>({ body_fat: '', body_water: '', muscle_mass: '', bone_mass: '' });
  const [showComp, setShowComp] = useState(false);
  const [recent, setRecent] = useState<{ inLastWeek: number; daysSince: number | null }>({ inLastWeek: 0, daysSince: null });
  const [saving, setSaving] = useState(false);
  const value = MIN + whole + dec / 10;

  const setFrom = (v: number) => {
    const r = Math.round(Math.max(MIN, Math.min(MAX, v)) * 10) / 10;
    setWhole(Math.floor(r) - MIN);
    setDec(Math.round((r - Math.floor(r)) * 10));
    setWheelKey((k) => k + 1);
  };

  useEffect(() => {
    (async () => {
      const entries = await weightRepository.getAll();
      const existing = id ? entries.find((e) => e.id === id) : undefined;
      if (existing) {
        setFrom(existing.valor);
        setDateTime(new Date(existing.fecha));
        const c = await bodyCompFor(existing.id);
        setComp({
          body_fat: c.body_fat != null ? num(c.body_fat) : '',
          body_water: c.body_water != null ? num(c.body_water) : '',
          muscle_mass: c.muscle_mass != null ? num(c.muscle_mass) : '',
          bone_mass: c.bone_mass != null ? num(c.bone_mass) : '',
        });
        setShowComp(Object.keys(c).length > 0);
      } else {
        const last = [...entries].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
        if (last) setFrom(last.valor);
        else {
          const p = await profileRepository.get().catch(() => null);
          if (p?.weightKg) setFrom(p.weightKg);
        }
        const a = weighAdvice(entries);
        setRecent({ inLastWeek: a.inLastWeek, daysSince: a.daysSince });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onPickerChange = (_e: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setPickerMode(null);
    if (!selected) return;
    setDateTime((prev) => {
      const next = new Date(prev);
      if (pickerMode === 'date') next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      else if (pickerMode === 'time') next.setHours(selected.getHours(), selected.getMinutes());
      return next;
    });
  };

  const parsed: BodyComp = {};
  const invalid: BodyCompKind[] = [];
  for (const b of BODY_COMP) {
    const raw = comp[b.kind];
    if (!raw.trim()) continue;
    const v = parseComp(b.kind, raw);
    if (v === null) invalid.push(b.kind);
    else parsed[b.kind] = v;
  }

  const save = async () => {
    if (invalid.length) return;
    setSaving(true);
    try {
      await saveWeighIn({ id, kg: Math.round(value * 10) / 10, fecha: dateTime.toISOString(), comp: parsed });
      if (!id) void offerPhoneReminders('weigh_in');
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    await removeWeighIn(id);
    router.back();
  };

  // Ya se pesó hace poco: no se bloquea, solo se explica
  const soon = !id && recent.daysSince !== null && recent.daysSince < 7;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} onPress={() => router.back()} accessibilityLabel={t('Close')}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.circleButton, !invalid.length && { backgroundColor: COLOR }]}
          onPress={save}
          disabled={!!invalid.length || saving}
          accessibilityLabel={t('Save')}
        >
          <Ionicons name="checkmark" size={22} color={Colors.background} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={[styles.iconBadge, { backgroundColor: withAlpha(COLOR, 0.14) }]}>
            <AppIcon name="mci:scale-bathroom" size={26} color={COLOR} />
          </View>
          <Text style={styles.title}>{t('Weight')}</Text>
        </View>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.accent} />
          <Text style={styles.noteText}>
            {soon
              ? recent.daysSince === 0
                ? t('You already weighed yourself today. Day-to-day changes are mostly water and food, not fat. Once a week is enough.')
                : recent.daysSince === 1
                  ? t('You weighed yourself yesterday. Day-to-day changes are mostly water and food, not fat. Once a week is enough.')
                  : t('You weighed yourself {n} days ago. Day-to-day changes are mostly water and food, not fat. Once a week is enough.', { n: recent.daysSince ?? 0 })
              : t('Once a week is enough: same day, in the morning, after the toilet and before breakfast, with little clothing. Weight swings 1–2 kg from one day to the next with food, salt, fluid retention or your cycle; the trend over several weeks is what counts.')}
          </Text>
        </View>

        <View style={styles.list}>
          <TouchableOpacity style={styles.row} onPress={() => setPickerMode('date')}>
            <Text style={styles.rowLabel}>{t('Date')}</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{formatDate(dateTime)}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => setPickerMode('time')}>
            <Text style={styles.rowLabel}>{t('Time')}</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{formatTime(dateTime)}</Text>
            </View>
          </TouchableOpacity>
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.rowLabel}>{t('Weight')}</Text>
            <Text style={styles.rowValue}>{num(value.toFixed(1))} kg</Text>
          </View>
        </View>

        <View style={styles.wheels} key={wheelKey}>
          <WheelPicker items={WHOLE} selectedIndex={whole} onChange={setWhole} width={84} />
          <Text style={styles.wheelComma}>{getLang() === 'en' ? '.' : ','}</Text>
          <WheelPicker items={DEC} selectedIndex={dec} onChange={setDec} width={56} />
          <Text style={styles.wheelUnit}>kg</Text>
        </View>

        <TouchableOpacity style={styles.compToggle} onPress={() => setShowComp((v) => !v)}>
          <AppIcon name="mci:human" size={18} color={Colors.accent} />
          <Text style={styles.compToggleText}>{t('Body composition (optional)')}</Text>
          <Ionicons name={showComp ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
        </TouchableOpacity>
        {showComp && (
          <View style={styles.compBox}>
            <Text style={styles.compHint}>
              {t('If your scale measures it, copy it here. It changes a lot with how hydrated you are, so compare it only between weigh-ins in the same conditions.')}
            </Text>
            {BODY_COMP.map((b) => (
              <View key={b.kind} style={styles.compRow}>
                <Text style={styles.compLabel}>{t(b.label)}</Text>
                <View style={[styles.compInputWrap, invalid.includes(b.kind) && { borderColor: Colors.danger }]}>
                  <TextInput
                    style={styles.compInput}
                    keyboardType="decimal-pad"
                    value={comp[b.kind]}
                    onChangeText={(v) => setComp((c) => ({ ...c, [b.kind]: v.replace(/[^\d.,]/g, '').slice(0, 5) }))}
                    placeholder="—"
                    placeholderTextColor={Colors.textMuted}
                    accessibilityLabel={t(b.label)}
                  />
                  <Text style={styles.compUnit}>{b.unit}</Text>
                </View>
              </View>
            ))}
            {invalid.length ? <Text style={styles.error}>{t('Check the values in red: they are outside the usual range.')}</Text> : null}
          </View>
        )}

        {id && (
          <TouchableOpacity style={styles.deleteButton} onPress={remove}>
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
            <Text style={styles.deleteText}>{t('Delete entry')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {pickerMode && <DateTimePicker value={dateTime} mode={pickerMode} display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onPickerChange} />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  circleButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', gap: 10, marginTop: 6, marginBottom: 14 },
  iconBadge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '900' },
  note: { flexDirection: 'row', gap: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 12, marginHorizontal: 20, marginBottom: 14 },
  noteText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  list: { backgroundColor: Colors.card, borderRadius: 16, marginHorizontal: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  pill: { backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  rowValue: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  wheelComma: { color: Colors.textPrimary, fontSize: 26, fontWeight: '800', marginHorizontal: 2 },
  wheelUnit: { color: Colors.textSecondary, fontSize: 16, fontWeight: '700', marginLeft: 8 },
  compToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 18, paddingVertical: 8 },
  compToggleText: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  compBox: { backgroundColor: Colors.card, borderRadius: 16, marginHorizontal: 20, padding: 14, gap: 10 },
  compHint: { color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
  compRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  compInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 10, minWidth: 110 },
  compInput: { flex: 1, color: Colors.textPrimary, fontSize: 16, paddingVertical: 7, textAlign: 'right' },
  compUnit: { color: Colors.textMuted, fontSize: 13, width: 22 },
  error: { color: Colors.danger, fontSize: 12 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 },
  deleteText: { color: Colors.danger, fontSize: 14, fontWeight: '700' },
});
