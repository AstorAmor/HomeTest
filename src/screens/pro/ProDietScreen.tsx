import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProLayout, useIsWide, useProIdentity } from '@/components/pro/ProLayout';
import { ChoiceChips } from '@/components/ChoiceChips';
import { RecipeImage } from '@/components/diet/RecipeImage';
import { MacroDonut } from '@/components/diet/MacroDonut';
import { issueText, MacroTargetsPanel, NumField } from '@/components/diet/MacroTargetsPanel';
import { Colors } from '@/constants/colors';
import { portal } from '@/data/specialistPortal';
import type { PatientSummary } from '@/data/specialistTypes';
import { getRecipe, recipeName, slotLabel } from '@/data/diet/catalog';
import { ALLERGENS, AVOID_GROUPS, BUDGETS, DIET_GOALS, DIET_TYPES, MARKER_NAME, SKILLS } from '@/data/diet/labels';
import type { DayTargets, DietPlan, DietPrefs, MealSlot, PlannedMeal } from '@/data/diet/types';
import {
  alternativesForSlot,
  DEFAULT_DIET_PREFS,
  dayLock,
  dayTotals,
  dietTargets,
  fitDay,
  fitPortions,
  generateDiet,
  prefsForDay,
  LabFlag,
  macroIssues,
  portionFor,
  REFERRAL_TEXT,
  referralReasons,
  weekSummary,
} from '@/logic/dietPlanner';
import { WEEKDAYS_LONG, WEEKDAYS_SHORT } from '@/screens/diet/DietScreen';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { num, t } from '@/i18n';
import { INTER } from '@/theme/fine';

// Portal → menú semanal de un paciente. El dietista parte del borrador que hace el generador con sus
// analíticas compartidas y sus objetivos, fija calorías y macros del día si quiere (y el reparto por
// comida: % de las kcal y gramos de cada macro), cambia platos, ajusta raciones, deja una indicación
// por comida y lo manda. Al paciente le sale en "Tu menú de la semana". Al cambiar kcal o macros las
// raciones se rehacen al momento con los mismos platos («Hacer el borrador» elige otros). Tocar un día
// abre su detalle: un objetivo propio para ese día, sus comidas con sus macros y raciones, y otra versión.
// ?from=diets: se abrió desde Portal → Dietas (vuelve ahí); si no, desde la ficha del paciente.

type Cell = { day: number; index: number } | null;

export const ProDietScreen = () => {
  const router = useRouter();
  const wide = useIsWide();
  const me = useProIdentity();
  const { patient: patientId, from } = useLocalSearchParams<{ patient: string; from?: string }>();
  const fromDiets = from === 'diets';
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [labs, setLabs] = useState<LabFlag[]>([]);
  const [prefs, setPrefs] = useState<DietPrefs>(DEFAULT_DIET_PREFS);
  const [existing, setExisting] = useState<DietPlan | null>(null);
  const [days, setDays] = useState<DietPlan['days']>([]);
  const [note, setNote] = useState('');
  const [cell, setCell] = useState<Cell>(null);
  const [dayOpen, setDayOpen] = useState<number | null>(null);
  const dayVersion = useRef(0);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useReloadOnFocus(
    useCallback(async () => {
      if (loaded) return;
      const [patients, lab, sent] = await Promise.all([
        portal.listPatients().catch(() => [] as PatientSummary[]),
        portal.patientLab(patientId).catch(() => null),
        portal.listDiets(patientId).catch(() => [] as DietPlan[]),
      ]);
      const p = patients.find((x) => x.id === patientId) ?? null;
      setPatient(p);
      const flags: LabFlag[] = (lab?.markers ?? []).filter((m) => m.status !== 'in').map((m) => ({ marker: m.id, status: m.status as 'high' | 'low', value: typeof m.value === 'number' ? m.value : undefined }));
      setLabs(flags);
      const last = sent[0];
      if (last) {
        setExisting(last);
        setPrefs(last.prefs);
        setDays(last.days);
        setNote(last.note ?? '');
      } else {
        const goals = (p?.goals ?? []).join(' ').toLowerCase();
        const start: DietPrefs = {
          ...DEFAULT_DIET_PREFS,
          goal: /weight|peso/.test(goals) ? 'lose' : /sport|deporte|rendimiento|perform/.test(goals) ? 'perform' : 'health',
          sex: /female|mujer/i.test(p?.sex ?? '') ? 'female' : /male|hombre/i.test(p?.sex ?? '') ? 'male' : null,
          age: p?.age ?? null,
        };
        setPrefs(start);
        setDays(generateDiet(start, flags).days);
      }
      setLoaded(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId, loaded]),
  );

  const set = (patch: Partial<DietPrefs>) => setPrefs((x) => ({ ...x, ...patch }));
  // Kcal, macros o reparto cambiados: las raciones de cada día se rehacen ya (mismos platos). Al abrir un
  // menú ya mandado no se tocan sus raciones hasta que cambie algún número.
  const fitKey = JSON.stringify([prefs.kcalTarget, prefs.proteinTarget, prefs.carbsTarget, prefs.fatTarget, prefs.meals]);
  const lastFit = useRef<string | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (lastFit.current === null) {
      lastFit.current = fitKey;
      return;
    }
    if (lastFit.current === fitKey) return;
    lastFit.current = fitKey;
    setDays((all) => fitPortions(all, prefs, labs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, loaded]);
  const g = useMemo(() => generateDiet(prefs, labs), [prefs, labs]); // objetivos y razones con los ajustes actuales
  const remake = (seed = prefs.seed) => {
    const next = { ...prefs, seed };
    setPrefs(next);
    setDays(generateDiet(next, labs).days);
  };
  const referral = referralReasons(prefs, labs);
  // Con números que no cuadran (la semana o algún día) no se manda: el panel y la hoja del día dicen qué es
  const blocked = loaded && (macroIssues(prefs, g.targets).length > 0 || days.some((d) => d.targets && macroIssues(prefsForDay(prefs, d), dietTargets(prefsForDay(prefs, d), labs)).length > 0));
  const summary = weekSummary(days);
  const slots = days[0]?.meals.map((m) => m.slot) ?? [];

  const current: PlannedMeal | undefined = cell ? days[cell.day]?.meals[cell.index] : undefined;
  const updateMeal = (patch: Partial<PlannedMeal>) =>
    cell && setDays((all) => all.map((d) => (d.day !== cell.day ? d : { ...d, meals: d.meals.map((m, i) => (i === cell.index ? { ...m, ...patch } : m)) })));
  const alternatives = useMemo(() => {
    if (!current) return [];
    const q = query.trim().toLowerCase();
    return alternativesForSlot(prefs, labs, current.slot, [current.recipeId]).filter((r) => !q || recipeName(r).toLowerCase().includes(q)).slice(0, 24);
  }, [current, prefs, labs, query]);

  const send = async () => {
    if (blocked) return;
    setState('saving');
    setError('');
    try {
      const base: DietPlan = existing ?? {
        id: `dp-${Date.now().toString(36)}`,
        title: 'Your weekly menu',
        createdAt: new Date().toISOString(),
        source: 'professional',
        prefs,
        targets: g.targets,
        reasons: g.reasons,
        days,
        active: true,
      };
      const plan: DietPlan = { ...base, prefs, targets: g.targets, reasons: g.reasons, days, note: note.trim() || undefined, active: true };
      await portal.sendDiet(patientId, plan, me.name);
      setExisting(plan);
      setState('sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not send the menu'));
      setState('error');
    }
  };

  const name = patient?.name ?? t('Patient');
  const back = fromDiets
    ? { label: t('Diets'), onPress: () => router.replace('/pro-diets') }
    : { label: name, onPress: () => router.replace({ pathname: '/pro-patient', params: { id: patientId } }) };
  const section = fromDiets ? 'diets' : 'patients';

  if (state === 'sent') {
    return (
      <ProLayout active={section} title={t('Weekly menu')} back={back}>
        <View style={styles.done}>
          <Ionicons name="checkmark-circle" size={56} color={Colors.ok} />
          <Text style={styles.doneTitle}>{t('Menu sent to {name}', { name })}</Text>
          <Text style={styles.mutedCenter}>{t('It appears in their app as their weekly menu, with your notes, the recipes and the shopping list.')}</Text>
          <TouchableOpacity style={styles.primary} onPress={() => setState('idle')}>
            <Text style={styles.primaryText}>{t('Keep editing')}</Text>
          </TouchableOpacity>
        </View>
      </ProLayout>
    );
  }

  return (
    <ProLayout
      active={section}
      title={`${t('Weekly menu')} · ${name}`}
      back={back}
      right={
        <TouchableOpacity style={[styles.send, blocked && { opacity: 0.45 }]} onPress={send} disabled={state === 'saving' || !loaded || blocked}>
          {state === 'saving' ? <ActivityIndicator size="small" color={Colors.background} /> : <Text style={styles.sendText}>{existing ? t('Update') : t('Send to patient')}</Text>}
        </TouchableOpacity>
      }
    >
      {!loaded ? (
        <ActivityIndicator color={Colors.accent} />
      ) : (
        <>
          <Text style={styles.intro}>{t('Draft made from their shared results and goals. Adjust the settings, swap dishes or servings and add notes before sending.')}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {blocked ? <Text style={styles.blocked}>{t('Some numbers do not add up: check them before sending the menu.')}</Text> : null}
          {referral.length ? (
            <View style={styles.warn}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.warning} />
              <View style={{ flex: 1 }}>
                {referral.map((r) => (
                  <Text key={r} style={styles.warnText}>
                    {t(REFERRAL_TEXT[r])}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}
          {labs.length ? (
            <Text style={styles.labs}>
              {t('Out of range')}: {labs.map((l) => `${t(MARKER_NAME[l.marker] ?? l.marker)} ${l.status === 'high' ? '↑' : '↓'}`).join(' · ')}
            </Text>
          ) : (
            <Text style={styles.labs}>{t('No shared results out of range.')}</Text>
          )}

          <View style={wide ? styles.columns : undefined}>
            <View style={[styles.panel, wide && styles.panelWide]}>
              <Text style={styles.label}>{t('Goal')}</Text>
              <ChoiceChips options={DIET_GOALS.map((x) => ({ id: x.id, label: t(x.label) }))} value={prefs.goal} onChange={(goal) => set({ goal })} />
              <Text style={styles.label}>{t('Diet')}</Text>
              <ChoiceChips options={DIET_TYPES.map((x) => ({ id: x.id, label: t(x.label) }))} value={prefs.diet} onChange={(diet) => set({ diet })} />
              <Text style={styles.label}>{t('Allergies')}</Text>
              <MultiChips options={ALLERGENS.map((a) => ({ id: a.id, label: t(a.label) }))} value={prefs.allergies} onChange={(allergies) => set({ allergies: allergies as DietPrefs['allergies'] })} />
              <Text style={styles.label}>{t('Leave out')}</Text>
              <MultiChips options={AVOID_GROUPS.map((a) => ({ id: a.id, label: t(a.label) }))} value={prefs.avoidGroups} onChange={(v) => set({ avoidGroups: v as DietPrefs['avoidGroups'] })} />
              <Text style={styles.label}>{t('Budget')}</Text>
              <ChoiceChips options={BUDGETS.map((x) => ({ id: x.id, label: t(x.label) }))} value={prefs.budget} onChange={(budget) => set({ budget })} />
              <Text style={styles.label}>{t('Cooking')}</Text>
              <ChoiceChips options={SKILLS.map((x) => ({ id: x.id, label: t(x.label) }))} value={prefs.skill} onChange={(skill) => set({ skill })} />
              <Text style={styles.label}>{t('Time available per meal')}</Text>
              <ChoiceChips options={[15, 30, 45, 60].map((m) => ({ id: m, label: m === 60 ? t('1 hour or more') : `${m} min` }))} value={prefs.minutes} onChange={(minutes) => set({ minutes })} />
              <Text style={styles.label}>{t('Snacks')}</Text>
              <ChoiceChips options={[0, 1, 2].map((n) => ({ id: n, label: String(n) }))} value={prefs.snacks} onChange={(snacks) => set({ snacks })} />
              <MacroTargetsPanel
                prefs={prefs}
                targets={g.targets}
                days={days}
                onChange={set}
                hint={t('Empty boxes share what is left of the day. Portions follow your numbers straight away; make the draft again to choose other dishes. Tap a day to adjust it on its own.')}
              />
              <View style={styles.genRow}>
                <TouchableOpacity style={styles.secondary} onPress={() => remake()}>
                  <Ionicons name="sparkles-outline" size={16} color={Colors.accent} />
                  <Text style={styles.secondaryText}>{t('Make the draft')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondary} onPress={() => remake(prefs.seed + 1)}>
                  <Ionicons name="shuffle" size={16} color={Colors.accent} />
                  <Text style={styles.secondaryText}>{t('Another version')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.summaryCard}>
                <MacroDonut m={summary} size={104} />
                <View style={styles.summaryFacts}>
                  <Text style={styles.summaryTitle}>{t('Daily average')}</Text>
                  <Text style={styles.summary}>
                    {t('Target')}: {num(g.targets.kcal)} kcal · {g.targets.protein} g {t('protein')} · {g.targets.carbs ?? '—'} g {t('carbs')} · {g.targets.fat ?? '—'} g {t('fat')}
                  </Text>
                  <Text style={styles.summary}>
                    {t('Menu')}: {num(Math.round(summary.kcal))} kcal · {Math.round(summary.protein)} g {t('protein')} · {Math.round(summary.carbs)} g {t('carbs')} · {Math.round(summary.fat)} g {t('fat')}
                  </Text>
                  <Text style={styles.summary}>
                    {t('fibre')} {Math.round(summary.fiber)} g · {t('sat. fat')} {num(Math.round(summary.satFatPct * 10) / 10)} % · {t('sodium')} {num(Math.round(summary.sodium))} mg
                  </Text>
                  <Text style={styles.summary}>
                    {t('Oily fish')} {summary.oilyFish} · {t('Legumes')} {summary.legumes} · {t('Red meat')} {summary.redMeat} · ~{Math.round(summary.cost)} €
                  </Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  <View style={styles.row}>
                    <View style={styles.rowLabel} />
                    {WEEKDAYS_SHORT.map((d, i) => (
                      <TouchableOpacity key={d} style={[styles.head, days[i]?.targets && styles.headOwn]} onPress={() => days[i] && setDayOpen(i)} accessibilityLabel={t(WEEKDAYS_LONG[i])}>
                        <Text style={styles.headText}>
                          {t(d)} <Ionicons name="chevron-forward" size={10} color={Colors.textMuted} />
                        </Text>
                        <Text style={[styles.headKcal, days[i]?.targets && { color: Colors.accent }]}>{num(Math.round(dayTotals(days[i] ?? { meals: [] }).kcal))}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {slots.map((slot: MealSlot, si) => (
                    <View key={`${slot}-${si}`} style={styles.row}>
                      <View style={styles.rowLabel}>
                        <Text style={styles.rowLabelText}>{slotLabel(slot)}</Text>
                      </View>
                      {days.map((d) => {
                        const m = d.meals[si];
                        const r = m && getRecipe(m.recipeId);
                        return (
                          <TouchableOpacity key={d.day} style={styles.cell} onPress={() => m && (setCell({ day: d.day, index: si }), setQuery(''))}>
                            {r ? (
                              <>
                                <RecipeImage recipeId={r.id} slot={slot} size={88} radius={10} />
                                <Text style={styles.cellName} numberOfLines={3}>
                                  {recipeName(r)}
                                </Text>
                                <Text style={styles.cellMeta}>
                                  {Math.round(r.nutrients.kcal * m.portion)} kcal
                                  {m.leftover ? ` · ${t('leftovers')}` : ''}
                                  {m.note ? ' · ✎' : ''}
                                </Text>
                              </>
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.label}>{t('Note to the patient')}</Text>
              <TextInput
                style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                multiline
                value={note}
                onChangeText={setNote}
                placeholder={t('What to watch, how to adapt it, when to tell you')}
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>
        </>
      )}

      <DaySheet
        index={dayOpen}
        days={days}
        prefs={prefs}
        labs={labs}
        onClose={() => setDayOpen(null)}
        onChange={(i, day) => setDays((all) => all.map((d) => (d.day === i ? day : d)))}
        onAnother={(i) => {
          dayVersion.current += 1;
          const d = days.find((x) => x.day === i);
          const alt = generateDiet({ ...prefsForDay(prefs, d), seed: prefs.seed + 100 * dayVersion.current + i }, labs).days[i];
          if (d && alt) setDays((all) => all.map((x) => (x.day === i ? fitDay({ ...alt, targets: d.targets }, prefs, labs) : x)));
        }}
        onOpenMeal={(i, index) => {
          setDayOpen(null);
          setCell({ day: i, index });
          setQuery('');
        }}
      />

      <Modal visible={!!current} transparent animationType="fade" onRequestClose={() => setCell(null)}>
        <Pressable style={styles.backdrop} onPress={() => setCell(null)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            {current && cell ? (
              <ScrollView contentContainerStyle={{ padding: 18, gap: 10 }} keyboardShouldPersistTaps="handled">
                <View style={styles.sheetHead}>
                  <Text style={styles.sheetTitle}>
                    {t(WEEKDAYS_SHORT[cell.day])} · {slotLabel(current.slot)}
                  </Text>
                  <TouchableOpacity onPress={() => setCell(null)} hitSlop={10}>
                    <Ionicons name="close" size={22} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.currentRow}>
                  <RecipeImage recipeId={current.recipeId} slot={current.slot} size={72} radius={12} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.currentName}>{recipeName(getRecipe(current.recipeId))}</Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity onPress={() => updateMeal({ portion: Math.max(0.5, current.portion - 0.25) })}>
                        <Ionicons name="remove-circle-outline" size={22} color={Colors.accent} />
                      </TouchableOpacity>
                      <Text style={styles.portion}>{Math.round((getRecipe(current.recipeId)?.nutrients.kcal ?? 0) * current.portion)} kcal</Text>
                      <TouchableOpacity onPress={() => updateMeal({ portion: Math.min(4, current.portion + 0.25) })}>
                        <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                {(() => {
                  const cr = getRecipe(current.recipeId);
                  return cr ? <MacroDonut m={{ kcal: cr.nutrients.kcal * current.portion, protein: cr.nutrients.protein * current.portion, carbs: cr.nutrients.carbs * current.portion, fat: cr.nutrients.fat * current.portion }} size={84} /> : null;
                })()}
                <TextInput
                  style={styles.input}
                  value={current.note ?? ''}
                  onChangeText={(v) => updateMeal({ note: v.slice(0, 160) || undefined })}
                  placeholder={t('Note for this meal (optional)')}
                  placeholderTextColor={Colors.textMuted}
                />
                <Text style={styles.label}>{t('Swap for')}</Text>
                <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder={t('Search a dish')} placeholderTextColor={Colors.textMuted} />
                {alternatives.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={styles.alt}
                    onPress={() => {
                      updateMeal({ recipeId: r.id, portion: portionFor(r.id, current.slot, prefsForDay(prefs, days[cell.day]), labs), leftover: false });
                      setCell(null);
                    }}
                  >
                    <RecipeImage recipeId={r.id} slot={current.slot} size={44} radius={8} />
                    <Text style={styles.altName}>{recipeName(r)}</Text>
                    <Text style={styles.altMeta}>
                      {Math.round(r.nutrients.kcal)} kcal · {r.minutes} min
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ProLayout>
  );
};

// El detalle de un día: lo que trae (kcal y macros), un objetivo propio para ese día si se quiere (vacío
// = el de la semana; al cambiarlo, sus raciones se rehacen), sus comidas con sus macros y su ración, y
// otra versión del día con otros platos
const DaySheet = ({
  index,
  days,
  prefs,
  labs,
  onClose,
  onChange,
  onAnother,
  onOpenMeal,
}: {
  index: number | null;
  days: DietPlan['days'];
  prefs: DietPrefs;
  labs: LabFlag[];
  onClose: () => void;
  onChange: (day: number, next: DietPlan['days'][number]) => void;
  onAnother: (day: number) => void;
  onOpenMeal: (day: number, index: number) => void;
}) => {
  const day = index != null ? days.find((d) => d.day === index) : undefined;
  if (!day || index == null) return null;
  // Lo vacío sugiere lo de este día: las kcal, las de la semana; los macros, los que salen de sus kcal
  const week = dietTargets(prefs, labs);
  const dayPrefs = prefsForDay(prefs, day);
  const own = dietTargets(dayPrefs, labs);
  // La misma regla que en la semana: con tres casillas puestas (las de este día o, si no, las de la semana), la cuarta sale de ellas
  const lock = dayLock(dayPrefs);
  const issues = macroIssues(dayPrefs, own);
  const totals = dayTotals(day);
  const setTarget = (patch: DayTargets) => {
    const merged = { ...(day.targets ?? {}), ...patch };
    const clean = Object.fromEntries(Object.entries(merged).filter(([, v]) => v)) as DayTargets;
    onChange(index, fitDay({ ...day, targets: Object.keys(clean).length ? clean : undefined }, prefs, labs));
  };
  const setPortion = (i: number, portion: number) => onChange(index, { ...day, meals: day.meals.map((m, k) => (k === i ? { ...m, portion } : m)) });
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <ScrollView contentContainerStyle={{ padding: 18, gap: 10 }} keyboardShouldPersistTaps="handled">
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t(WEEKDAYS_LONG[index])}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.dayTop}>
              <MacroDonut m={totals} size={96} />
            </View>
            <Text style={styles.summary}>
              {t('Target')}: {num(own.kcal)} kcal · {own.protein} g {t('protein')} · {own.carbs ?? '—'} g {t('carbs')} · {own.fat ?? '—'} g {t('fat')}
            </Text>

            <View style={styles.mealsHead}>
              <Text style={[styles.label, { flex: 1 }]}>{t('Target for this day')}</Text>
              {day.targets ? (
                <TouchableOpacity onPress={() => onChange(index, fitDay({ ...day, targets: undefined }, prefs, labs))} hitSlop={8}>
                  <Text style={styles.reset}>{t('Same as the week')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.targets}>
              <NumField label={t('kcal a day')} value={day.targets?.kcal} placeholder={lock === 'kcal' ? own.kcal : week.kcal} locked={lock === 'kcal'} onChange={(kcal) => setTarget({ kcal })} />
              <NumField label={t('Protein (g)')} value={day.targets?.protein} placeholder={own.protein} locked={lock === 'protein'} onChange={(protein) => setTarget({ protein })} />
            </View>
            <View style={styles.targets}>
              <NumField label={t('Carbs (g)')} value={day.targets?.carbs} placeholder={own.carbs ?? 0} locked={lock === 'carbs'} onChange={(carbs) => setTarget({ carbs })} />
              <NumField label={t('Fat (g)')} value={day.targets?.fat} placeholder={own.fat ?? 0} locked={lock === 'fat'} onChange={(fat) => setTarget({ fat })} />
            </View>
            {issues.map((i) => (
              <Text key={i.kind === 'column' ? `c-${i.col}` : i.kind === 'meal' ? `m-${i.slot}` : 'd'} style={styles.blocked}>
                {issueText(i, dayPrefs)}
              </Text>
            ))}

            <Text style={styles.label}>{t('Meals')}</Text>
            {day.meals.map((m, i) => {
              const r = getRecipe(m.recipeId);
              if (!r) return null;
              const k = (v: number) => Math.round(v * m.portion);
              return (
                <View key={`${m.slot}-${i}`} style={styles.dayMeal}>
                  <TouchableOpacity style={styles.dayMealMain} onPress={() => onOpenMeal(index, i)} activeOpacity={0.8}>
                    <RecipeImage recipeId={r.id} slot={m.slot} size={44} radius={8} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dayMealSlot}>{slotLabel(m.slot)}</Text>
                      <Text style={styles.altName} numberOfLines={2}>
                        {recipeName(r)}
                      </Text>
                      <Text style={styles.altMeta}>
                        {t('{kcal} kcal · P {p} · C {c} · F {f}', { kcal: num(k(r.nutrients.kcal)), p: k(r.nutrients.protein), c: k(r.nutrients.carbs), f: k(r.nutrients.fat) })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.dayStepper}>
                    <TouchableOpacity onPress={() => setPortion(i, Math.max(0.5, m.portion - 0.25))} hitSlop={6} accessibilityLabel={t('Smaller serving')}>
                      <Ionicons name="remove-circle-outline" size={22} color={Colors.accent} />
                    </TouchableOpacity>
                    <Text style={styles.portion}>×{num(m.portion)}</Text>
                    <TouchableOpacity onPress={() => setPortion(i, Math.min(4, m.portion + 0.25))} hitSlop={6} accessibilityLabel={t('Bigger serving')}>
                      <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
            <View style={styles.genRow}>
              <TouchableOpacity style={styles.secondary} onPress={() => onAnother(index)}>
                <Ionicons name="shuffle" size={16} color={Colors.accent} />
                <Text style={styles.secondaryText}>{t('Another version of this day')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const MultiChips = ({ options, value, onChange }: { options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) => (
  <View style={styles.chips}>
    {options.map((o) => {
      const on = value.includes(o.id);
      return (
        <TouchableOpacity key={o.id} style={[styles.chip, on && styles.chipOn]} onPress={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}>
          <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  intro: { color: Colors.textSecondary, fontFamily: INTER.regular, fontSize: 13, marginBottom: 8 },
  error: { color: Colors.danger, fontFamily: INTER.regular, fontSize: 13, marginBottom: 8 },
  blocked: { color: Colors.warning, fontFamily: INTER.regular, fontSize: 12, lineHeight: 16, marginBottom: 6 },
  warn: { flexDirection: 'row', gap: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.warning, borderRadius: 12, padding: 10, marginBottom: 8 },
  warnText: { color: Colors.textPrimary, fontFamily: INTER.regular, fontSize: 13 },
  labs: { color: Colors.textPrimary, fontSize: 13, fontFamily: INTER.medium, marginBottom: 10 },
  columns: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  panel: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 14, marginBottom: 14 },
  panelWide: { width: 340 },
  label: { color: Colors.textPrimary, fontSize: 13, fontFamily: INTER.medium, marginTop: 12, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.background, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  chipText: { color: Colors.textSecondary, fontSize: 12, fontFamily: INTER.medium },
  chipTextOn: { color: Colors.textPrimary },
  targets: { flexDirection: 'row', gap: 10 },
  mealsHead: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  reset: { color: Colors.accent, fontSize: 12, fontFamily: INTER.medium, marginTop: 6 },
  input: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.background, borderRadius: 10, padding: 9, color: Colors.textPrimary, fontFamily: INTER.regular, fontSize: 14 },
  genRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  secondaryText: { color: Colors.accent, fontSize: 13, fontFamily: INTER.medium },
  summary: { color: Colors.textSecondary, fontFamily: INTER.regular, fontSize: 12 },
  summaryCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 12, marginBottom: 12 },
  summaryFacts: { flex: 1, minWidth: 220, gap: 4 },
  summaryTitle: { color: Colors.textPrimary, fontSize: 14, fontFamily: INTER.medium },
  row: { flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'flex-start' },
  rowLabel: { width: 70, paddingTop: 4 },
  rowLabelText: { color: Colors.textSecondary, fontSize: 11, fontFamily: INTER.medium },
  head: { width: 96, alignItems: 'center', marginTop: 6 },
  headText: { color: Colors.textPrimary, fontSize: 12, fontFamily: INTER.medium },
  headKcal: { color: Colors.textMuted, fontFamily: INTER.regular, fontSize: 10 },
  headOwn: { borderBottomWidth: 2, borderBottomColor: Colors.accent },
  dayTop: { alignItems: 'center' },
  dayMeal: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 8 },
  dayMealMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayMealSlot: { color: Colors.textMuted, fontSize: 10, fontFamily: INTER.semibold, textTransform: 'uppercase' },
  dayStepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cell: { width: 96, gap: 3 },
  cellName: { color: Colors.textPrimary, fontSize: 10, fontFamily: INTER.medium },
  cellMeta: { color: Colors.textMuted, fontFamily: INTER.regular, fontSize: 10 },
  send: { backgroundColor: Colors.accent, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  sendText: { color: Colors.background, fontSize: 13, fontFamily: INTER.medium },
  done: { alignItems: 'center', gap: 12, marginTop: 60, paddingHorizontal: 20 },
  doneTitle: { color: Colors.textPrimary, fontSize: 22, fontFamily: INTER.medium, textAlign: 'center' },
  mutedCenter: { color: Colors.textSecondary, fontFamily: INTER.regular, fontSize: 13, textAlign: 'center', maxWidth: 520 },
  primary: { backgroundColor: Colors.accent, borderRadius: 22, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  primaryText: { color: Colors.background, fontSize: 14, fontFamily: INTER.medium },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '90%', backgroundColor: Colors.background, borderRadius: 18, borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: Colors.textPrimary, fontSize: 17, fontFamily: INTER.medium },
  currentRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  currentName: { color: Colors.textPrimary, fontSize: 15, fontFamily: INTER.medium },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  portion: { color: Colors.textSecondary, fontSize: 13, fontFamily: INTER.medium },
  alt: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  altName: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontFamily: INTER.medium },
  altMeta: { color: Colors.textMuted, fontFamily: INTER.regular, fontSize: 11 },
});
