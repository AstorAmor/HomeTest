import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, withAlpha } from '@/constants/colors';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { currentReport } from '@/data/reportRepository';
import { profileRepository } from '@/data/profileRepository';
import { buildPlan } from '@/data/planRepository';
import { userFlags } from '@/data/userFlags';
import { NutrientFocus, nutrientFocus } from '@/logic/nutrients';
import { t } from '@/i18n';

// Lo marcado hoy (user_flags "nutrients:YYYY-MM-DD")
export const nutrientsKey = (d = new Date()) => `nutrients:${d.toISOString().slice(0, 10)}`;

export async function loadNutrientFocus(): Promise<NutrientFocus[]> {
  const profile = await profileRepository.get().catch(() => null);
  const planTips = buildPlan(profile).find((p) => p.kind === 'nutrition')?.how ?? [];
  const markers = currentReport.sections.flatMap((s) => s.markers).map((m) => ({ marker_id: m.marker_id, flag: m.flag }));
  return nutrientFocus(markers, planTips);
}

export async function nutrientsDoneToday(): Promise<string[]> {
  const v = await userFlags.get(nutrientsKey());
  return v && typeof v === 'object' && Array.isArray((v as { ids?: unknown }).ids) ? ((v as { ids: string[] }).ids) : [];
}

// "Your nutrients": lo que conviene recordar hoy según tus resultados, con su casilla diaria.
export const NutrientsScreen = () => {
  const router = useRouter();
  const [items, setItems] = useState<NutrientFocus[]>([]);
  const [done, setDone] = useState<string[]>([]);

  useReloadOnFocus(
    useCallback(async () => {
      const [f, d] = await Promise.all([loadNutrientFocus(), nutrientsDoneToday()]);
      setItems(f);
      setDone(d);
    }, []),
  );

  const toggle = (id: string) => {
    const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id];
    setDone(next);
    userFlags.set(nutrientsKey(), { ids: next });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Your nutrients')} showBack />
        <Text style={styles.intro}>
          {t('What to keep in mind today, based on your latest results and your plan. Tick what you managed.')}
        </Text>
        <Text style={styles.count}>{t('{done} of {total} today', { done: done.filter((d) => items.some((i) => i.id === d)).length, total: items.length })}</Text>

        {items.map((it) => {
          const on = done.includes(it.id);
          return (
            <TouchableOpacity key={it.id} style={[styles.card, on && styles.cardOn]} onPress={() => toggle(it.id)} activeOpacity={0.85}>
              <View style={[styles.icon, { backgroundColor: withAlpha(Colors.gold, 0.14) }]}>
                <MaterialCommunityIcons name={it.icon as any} size={20} color={Colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{it.title}</Text>
                <Text style={styles.why}>{it.why}</Text>
                {it.foods ? <Text style={styles.foods}>{it.foods}</Text> : null}
              </View>
              <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={on ? Colors.ok : Colors.textMuted} />
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity style={styles.meal} onPress={() => router.push('/log-meal')}>
          <Ionicons name="camera-outline" size={18} color={Colors.accent} />
          <Text style={styles.mealText}>{t('Snap a meal')}</Text>
        </TouchableOpacity>
        <Text style={styles.note}>{t('General guidance on food, not a diet prescription. A dietitian can tailor it to you.')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginBottom: 6 },
  count: { color: Colors.gold, fontSize: 13, fontWeight: '800', marginHorizontal: 20, marginBottom: 12 },
  card: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  cardOn: { borderColor: withAlpha(Colors.ok, 0.6) },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  why: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  foods: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19, marginTop: 6 },
  meal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, paddingVertical: 12 },
  mealText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  note: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginHorizontal: 24, marginTop: 6, textAlign: 'center' },
});
