// Pantallas de objetivos y metas (prototipo v3, 2026-11-04). Rutas en src/app/metas*.tsx; lógica en
// src/logic/metas.ts; datos en src/hooks/useMetas.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useMetas, type MetasApi } from '@/hooks/useMetas';
import { SERVING_INFO, META_EVIDENCE } from '@/data/metasInfo';
import {
  ALCOHOL,
  AREAS,
  AREA_NAME,
  CATALOG,
  GOALS,
  GOALS_MAX,
  LAB_GOALS,
  METAS_MAX,
  OWN_GOALS,
  TOBACCO,
  areaScore,
  cfgWithPer,
  cfgWithTobaccoUnit,
  customText,
  dayMonth,
  defaultCfg,
  evalMeta,
  goalAllowed,
  labGoalText,
  metaAllowed,
  metaText,
  pickList,
  progressText,
  rangeText,
  recommended,
  resolveMeta,
  selectedIds,
  sortGoals,
  sourceText,
  toggleSel,
  tooMany,
  upperFirst,
  weekdayName,
  type AlcoholKind,
  type Area,
  type GoalKey,
  type Kind,
  type MetaCfg,
  type MetasState,
  type Per,
  type TobaccoUnit,
} from '@/logic/metas';
import {
  AREA_COLOR,
  AreaRing,
  CelebrateRing,
  Checkbox,
  MetaCard,
  PartyOverlay,
  type Party,
  MetasScreenFrame,
  Segmented,
  SmallStepper,
  SourceSwitch,
  TargetStepper,
  metaStyles as ms,
  pct,
} from '@/components/metas/MetaParts';
import { t } from '@/i18n';
import { planVersionRepository } from '@/data/planVersions';
import { specialistPlans } from '@/logic/specialistPlan';

const isArea = (a: unknown): a is Area => typeof a === 'string' && (AREAS as string[]).includes(a);
const lowerFirst = (s: string) => (/^[A-ZÁÉÍÓÚ][a-záéíóúñ ]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

function Loading({ title }: { title: string }) {
  return (
    <MetasScreenFrame title={title}>
      <View />
    </MetasScreenFrame>
  );
}

// Cambia la configuración de una meta (la de siempre, si no tenía)
const withCfg = (s: MetasState, id: string, cfg: MetaCfg): MetasState => ({ ...s, cfg: { ...s.cfg, [id]: cfg } });
const cfgOf = (s: MetasState, id: string): MetaCfg => ({ ...(CATALOG[id] ? defaultCfg(CATALOG[id]) : { tgt: 1, per: 'day' as Per }), ...s.cfg[id] });
const toggleSource = (api: MetasApi, id: string) => {
  const s = api.data!.state;
  const m = resolveMeta(s, id);
  if (m) api.update(withCfg(s, id, { ...cfgOf(s, id), auto: !m.autoOn }));
};

// ===== Tus objetivos =====
export function MetasHomeScreen() {
  const router = useRouter();
  const api = useMetas();
  if (!api.data) return <Loading title={t('Your goals')} />;
  const { state: s, lab } = api.data;
  const rec = s.goals.filter((g) => GOALS[g].lab);
  const own = s.goals.filter((g) => !GOALS[g].lab);

  const goalCard = (g: GoalKey) => {
    const lg = lab.find((x) => x.key === g);
    return (
      <View key={g} style={[ms.card, styles.goal]}>
        <View style={styles.goalIcon}>
          <Ionicons name={GOALS[g].icon as any} size={18} color={Colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ms.rowT}>{t(GOALS[g].name)}</Text>
          <Text style={ms.rowD}>{[lg ? labGoalText(lg) : null, t(GOALS[g].track)].filter(Boolean).join(' ')}</Text>
        </View>
      </View>
    );
  };

  return (
    <MetasScreenFrame title={t('Your goals')}>
      {rec.length > 0 && <Text style={ms.sec}>{t('Recommended for you')}</Text>}
      {rec.map(goalCard)}
      {own.length > 0 && <Text style={ms.sec}>{t('Your own')}</Text>}
      {own.map(goalCard)}
      {!s.goals.length && (
        <View style={ms.card}>
          <Text style={ms.p}>{t('You have no goals yet.')}</Text>
        </View>
      )}
      <TouchableOpacity style={ms.btnSoft} onPress={() => router.push('/metas-objetivos')}>
        <Text style={ms.btnSoftText}>{t('Change my goals')}</Text>
      </TouchableOpacity>

      <Text style={ms.sec}>{t('Your action areas')}</Text>
      {AREAS.map((a) => {
        const f = areaScore(s, a, api.vals, api.week ?? undefined, api.known);
        return (
          <TouchableOpacity
            key={a}
            style={ms.card}
            activeOpacity={0.85}
            onPress={() => router.push(s.sel[a].length ? { pathname: '/metas-area', params: { area: a } } : { pathname: '/metas-elegir', params: { area: a } })}
          >
            <View style={styles.areaHead}>
              <AreaRing area={a} score={f} size={34} stroke={4} />
              <Text style={[styles.areaName, { color: AREA_COLOR[a] }]}>{t(AREA_NAME[a])}</Text>
              <Text style={styles.areaPct}>{f == null ? '—' : pct(f)}</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </View>
            {s.sel[a].length ? (
              s.sel[a].map((id) => {
                const m = resolveMeta(s, id);
                if (!m) return null;
                return (
                  <View key={id} style={styles.areaRow}>
                    <Text style={styles.areaRowT}>{metaText(m)}</Text>
                    <Text style={styles.areaRowP}>{progressText(m, evalMeta(m, api.vals[id] ?? Array(7).fill(null), api.week ?? undefined, api.known[id]))}</Text>
                  </View>
                );
              })
            ) : (
              <Text style={[styles.areaRowP, { marginTop: 8 }]}>{t('No targets')}</Text>
            )}
          </TouchableOpacity>
        );
      })}
      {/* «Tu plan completo» ya no se enlaza desde aquí (fundador, 2026-11-05: ya no aporta). Desde el
          2026-11-06 el único plan es el que manda un especialista: si hay alguno, se enlaza aquí */}
      <SpecialistPlanLink />
      <CommitLink s={s} />
    </MetasScreenFrame>
  );
}

export function SpecialistPlanLink() {
  const router = useRouter();
  const [latest, setLatest] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    planVersionRepository
      .getAll()
      .then((v) => alive && setLatest(specialistPlans(v)[0]?.createdAt ?? null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  if (!latest) return null;
  return (
    <TouchableOpacity style={[ms.card, styles.goal]} activeOpacity={0.85} onPress={() => router.push('/plans')}>
      <View style={styles.goalIcon}>
        <Ionicons name="medkit-outline" size={18} color={Colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ms.rowT}>{t('Your specialist’s plan')}</Text>
        <Text style={ms.rowD}>{t('Sent on {date}', { date: dayMonth(latest.slice(0, 10)) })}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

export function CommitLink({ s }: { s: MetasState }) {
  const router = useRouter();
  if (!selectedIds(s).length) return null;
  if (!s.commit)
    return (
      <TouchableOpacity style={ms.btn} onPress={() => router.push('/metas-firmar')}>
        <Text style={ms.btnText}>{t('Sign your commitment')}</Text>
      </TouchableOpacity>
    );
  return (
    <TouchableOpacity onPress={() => router.push('/metas-firmar')} style={styles.commitLink}>
      <Ionicons name="checkmark-circle" size={16} color={Colors.ok} />
      <Text style={ms.rowD}>{t('Commitment signed on {date}, for {n} weeks', { date: dayMonth(s.commit.day), n: s.commit.weeks })}</Text>
    </TouchableOpacity>
  );
}

// ===== Elegir tus objetivos =====
export function GoalsPickScreen() {
  const api = useMetas();
  if (!api.data) return <Loading title={t('Your goals')} />;
  const { state: s, lab, who } = api.data;
  const full = s.goals.length >= GOALS_MAX;
  const recKeys = lab.map((g) => g.key);
  const toggle = (g: GoalKey) => {
    const on = s.goals.includes(g);
    const goals = on ? s.goals.filter((x) => x !== g) : sortGoals([...s.goals, g]);
    api.update({ ...s, goals });
  };
  const row = (g: GoalKey) => {
    const on = s.goals.includes(g);
    const lg = lab.find((x) => x.key === g);
    return (
      <View key={g} style={[ms.row, full && !on && { opacity: 0.5 }]}>
        <Checkbox on={on} disabled={full && !on} onPress={() => toggle(g)} label={t(GOALS[g].name)} />
        <View style={{ flex: 1 }}>
          <Text style={ms.rowT}>{t(GOALS[g].name)}</Text>
          {lg && <Text style={ms.rowD}>{labGoalText(lg)}</Text>}
        </View>
        <Ionicons name={GOALS[g].icon as any} size={18} color={Colors.textMuted} />
      </View>
    );
  };
  // Un objetivo de la analítica que ya no sale recomendado pero sigue elegido, también se puede quitar
  const labShown = LAB_GOALS.filter((g) => recKeys.includes(g) || s.goals.includes(g));
  return (
    <MetasScreenFrame title={t('Your goals')}>
      <Text style={ms.sub}>{t('Up to {n}. Change them whenever you want.', { n: GOALS_MAX })}</Text>
      <Text style={ms.sec}>{t('Recommended by your blood test')}</Text>
      {labShown.length ? (
        <View style={ms.cardList}>{labShown.map(row)}</View>
      ) : (
        <Text style={ms.meta}>{t('Your blood test does not point to any goal for now.')}</Text>
      )}
      <Text style={ms.sec}>{t('Add your own')}</Text>
      <View style={ms.cardList}>{OWN_GOALS.filter((g) => goalAllowed(g, who) || s.goals.includes(g)).map(row)}</View>
      <Text style={ms.meta}>{t('{n} of {max}. With the ones you choose, we recommend targets in each area.', { n: s.goals.length, max: GOALS_MAX })}</Text>
      {/* Las metas, aquí mismo, debajo de los objetivos (fundador, 2026-11-06): las que tienes y las que
          recomiendan los objetivos que eliges, que cambian al marcar uno. «Ver todas», a las del área. */}
      <Text style={ms.sec}>{t('Your targets')}</Text>
      <Text style={ms.sub}>{t('The recommended ones come from the goals you choose.')}</Text>
      {AREAS.some((a) => tooMany(s, a)) && <ManyTip />}
      {AREAS.map((a) => (
        <AreaTargets key={a} api={api} area={a} />
      ))}
    </MetasScreenFrame>
  );
}

// Más de 3 metas en un área: se puede, pero mejor consolidar unas pocas antes de sumar más (fundador, 2026-11-06)
function ManyTip() {
  return (
    <View style={styles.manyTip}>
      <Ionicons name="bulb-outline" size={18} color={Colors.accent} />
      <Text style={styles.manyTipText}>
        {t('It is great that you set yourself lots of targets, but sometimes it pays to consolidate a few (up to {n} per area) before moving on to the next ones.', { n: METAS_MAX })}
      </Text>
    </View>
  );
}

function AreaTargets({ api, area: a }: { api: MetasApi; area: Area }) {
  const router = useRouter();
  const { state: s, who } = api.data!;
  const sel = s.sel[a];
  const rec = recommended(a, s.goals, who);
  // Una que quitas sigue en la lista mientras estás aquí (si no, desaparece y la lista salta)
  const seen = useRef(new Set<string>()).current;
  for (const id of sel) seen.add(id);
  const ids = pickList(a, s, who).filter((id) => seen.has(id) || rec.includes(id));
  return (
    <View style={ms.cardList}>
      <TouchableOpacity
        style={[styles.quickHead, ids.length > 0 && styles.quickHeadLine]}
        onPress={() => router.push({ pathname: '/metas-elegir', params: { area: a } })}
        activeOpacity={0.85}
        accessibilityLabel={`${t(AREA_NAME[a])}: ${t('See all')}`}
      >
        <Text style={[styles.areaName, { color: AREA_COLOR[a] }]}>{t(AREA_NAME[a])}</Text>
        <Text style={ms.link}>{t('See all')}</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
      </TouchableOpacity>
      {ids.map((id, i) => {
        const m = resolveMeta(s, id);
        if (!m) return null;
        const on = sel.includes(id);
        return (
          <View key={id} style={[ms.row, i === ids.length - 1 && styles.lastRow]}>
            <Checkbox on={on} onPress={() => api.update(toggleSel(s, a, id, who))} label={metaText(m)} />
            <View style={{ flex: 1 }}>
              <Text style={ms.rowT}>{metaText(m)}</Text>
              {rec.includes(id) && <Text style={ms.tag}>{t('Recommended')}</Text>}
            </View>
            {on && (
              <TouchableOpacity onPress={() => router.push({ pathname: '/metas-ajustar', params: { id } })} hitSlop={8}>
                <Text style={ms.link}>{t('Adjust')}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
      {!ids.length && <Text style={styles.quickEmpty}>{t('No recommended targets here for now.')}</Text>}
    </View>
  );
}

// ===== Un área: su donut y sus metas =====
export function MetasAreaScreen() {
  const router = useRouter();
  const { area } = useLocalSearchParams<{ area?: string }>();
  const a: Area = isArea(area) ? area : 'ej';
  const api = useMetas();
  // La semana en curso o la pasada (para apuntar el domingo el lunes, por ejemplo)
  const [offset, setOffset] = useState(0);
  const { weekView } = api;
  const view = useMemo(() => weekView(offset), [weekView, offset]);
  // Al llegar al 100 % marcando (en la semana en curso): el donut celebra y salta el confeti
  const armed = useRef(false);
  const [party, setParty] = useState<Party>(null);
  const partyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onParty = useCallback((kind: 'area' | 'all') => {
    setParty((p) => ({ kind, n: (p?.n ?? 0) + 1 }));
    if (partyTimer.current) clearTimeout(partyTimer.current);
    partyTimer.current = setTimeout(() => setParty(null), kind === 'all' ? 4600 : 3000);
  }, []);
  useEffect(() => () => {
    if (partyTimer.current) clearTimeout(partyTimer.current);
  }, []);
  if (!api.data || !view) return <Loading title={t(AREA_NAME[a])} />;
  const s = api.data.state;
  const { week, days, vals, known } = view;
  const f = areaScore(s, a, vals, week, known);
  const allDone = AREAS.every((x) => !s.sel[x].length || (areaScore(s, x, vals, week, known) ?? 0) >= 1) && AREAS.some((x) => s.sel[x].length > 0);
  // A la pasada se puede ir si ya habías empezado entonces (sin compromiso, siempre)
  const canBack = offset === 0 && (!s.commit || s.commit.day < days[0]);
  const first = week.from > 0 && week.from <= 6;
  return (
    <MetasScreenFrame title={t(AREA_NAME[a])} overlay={<PartyOverlay party={party} />}>
      <View style={styles.weekBar}>
        <TouchableOpacity
          onPress={() => setOffset(-1)}
          disabled={!canBack}
          style={[styles.weekArrow, !canBack && { opacity: 0 }]}
          hitSlop={10}
          accessibilityLabel={t('Last week')}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.weekTitle}>{t(offset === 0 ? 'This week' : 'Last week')}</Text>
          <Text style={styles.weekRange}>{upperFirst(rangeText(days[0], days[6]))}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setOffset(0)}
          disabled={offset === 0}
          style={[styles.weekArrow, offset === 0 && { opacity: 0 }]}
          hitSlop={10}
          accessibilityLabel={t('This week')}
        >
          <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={styles.bigRing}>
        <CelebrateRing area={a} score={f} allDone={allDone} armed={armed} onParty={onParty} size={124} stroke={8} sub={t(offset === 0 ? 'this week' : 'last week')} />
      </View>
      {first && (
        <Text style={styles.weekNote}>
          {t('Your first week counts from {day}: weekly targets go in proportion.', { day: `${weekdayName(days[week.from])} ${dateOfDay(days[week.from])}` })}
        </Text>
      )}
      {s.sel[a].length ? (
        <View style={ms.cardList}>
          {s.sel[a].map((id) => {
            const m = resolveMeta(s, id);
            if (!m) return null;
            return (
              <MetaCard
                key={`${id}:${days[0]}`}
                m={m}
                vals={vals[id] ?? Array(7).fill(null)}
                autoVals={days.map((d) => api.auto[id]?.[d] ?? null)}
                fixed={days.map((d) => api.data?.manual[id]?.[d] != null)}
                days={days}
                week={week}
                known={known[id]}
                color={AREA_COLOR[a]}
                onSet={(day, v) => {
                  armed.current = offset === 0;
                  api.setValue(m, day, v);
                }}
                onToggleSource={() => toggleSource(api, id)}
              />
            );
          })}
        </View>
      ) : (
        <View style={ms.card}>
          <Text style={ms.p}>{t('You have no targets here.')}</Text>
        </View>
      )}
      <TouchableOpacity style={ms.btnSoft} onPress={() => router.push({ pathname: '/metas-elegir', params: { area: a } })}>
        <Text style={ms.btnSoftText}>{t('Change my targets')}</Text>
      </TouchableOpacity>
    </MetasScreenFrame>
  );
}
const dateOfDay = (k: string) => String(Number(k.slice(8, 10)));

// ===== Tus metas: las que quieras por área (con más de 3, el aviso arriba) =====
export function MetasPickScreen() {
  const router = useRouter();
  const { area } = useLocalSearchParams<{ area?: string }>();
  const [a, setA] = useState<Area>(isArea(area) ? area : 'ej');
  const api = useMetas();
  if (!api.data) return <Loading title={t('Your targets')} />;
  const { state: s, who } = api.data;
  const sel = s.sel[a];
  const rec = recommended(a, s.goals, who);
  const ids = pickList(a, s, who);
  const toggle = (id: string) => api.update(toggleSel(s, a, id, who));
  return (
    <MetasScreenFrame title={t('Your targets')}>
      <Segmented options={AREAS.map((k) => [k, t(AREA_NAME[k])] as [Area, string])} value={a} onChange={setA} />
      {tooMany(s, a) && <ManyTip />}
      <Text style={ms.sub}>{t('The recommended ones come from your goals.')}</Text>
      <View style={ms.cardList}>
        {ids.map((id) => {
          const m = resolveMeta(s, id);
          if (!m) return null;
          const on = sel.includes(id);
          // Fumar y beber salen a todos; la nota, solo a quien lo marcó (esas van primero)
          const marked = !!m.def?.only && metaAllowed(id, who);
          const only = !marked ? null : m.def?.only === 'smoker' ? t('Shown because you said you smoke') : t('Shown because you said you drink alcohol');
          return (
            <View key={id} style={ms.row}>
              <Checkbox on={on} onPress={() => toggle(id)} label={metaText(m)} />
              <View style={{ flex: 1 }}>
                <Text style={ms.rowT}>{metaText(m)}</Text>
                <View style={styles.tags}>
                  {rec.includes(id) && <Text style={ms.tag}>{t('Recommended')}</Text>}
                  {m.custom && <Text style={[ms.tag, styles.tagOwn]}>{t('Your own one')}</Text>}
                </View>
                <Text style={ms.rowD}>{[sourceText(m), only].filter(Boolean).join(' · ')}</Text>
              </View>
              {on ? (
                <TouchableOpacity onPress={() => router.push({ pathname: '/metas-ajustar', params: { id } })} hitSlop={8}>
                  <Text style={ms.link}>{t('Adjust')}</Text>
                </TouchableOpacity>
              ) : !m.custom ? (
                <TouchableOpacity onPress={() => router.push({ pathname: '/metas-info', params: { id } })} hitSlop={8} accessibilityLabel={t('Information')}>
                  <Ionicons name="information-circle-outline" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => router.push({ pathname: '/metas-ajustar', params: { id } })} hitSlop={8}>
                  <Text style={ms.link}>{t('Adjust')}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
      <TouchableOpacity style={ms.btnSoft} onPress={() => router.push({ pathname: '/metas-otra', params: { area: a } })}>
        <Text style={ms.btnSoftText}>{t('+ Other target')}</Text>
      </TouchableOpacity>
      {selectedIds(s).length > 0 && !s.commit && (
        <TouchableOpacity style={ms.btn} onPress={() => router.push('/metas-firmar')}>
          <Text style={ms.btnText}>{t('Sign your commitment')}</Text>
        </TouchableOpacity>
      )}
    </MetasScreenFrame>
  );
}

// ===== Ajustar una meta =====
export function MetaAdjustScreen() {
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id?: string }>();
  const id = String(rawId ?? '');
  const api = useMetas();
  const [draft, setDraft] = useState<MetaCfg | null>(null);
  const loaded = api.data;
  useEffect(() => {
    if (loaded && !draft) setDraft(cfgOf(loaded.state, id));
  }, [loaded, draft, id]);
  if (!api.data || !draft) return <Loading title={t('Adjust your target')} />;
  const s = api.data.state;
  const preview = withCfg(s, id, draft);
  const m = resolveMeta(preview, id);
  if (!m) return <Loading title={t('Adjust your target')} />;
  const def = m.def;
  const save = () => {
    api.update(preview);
    router.canGoBack() ? router.back() : router.replace({ pathname: '/metas-area', params: { area: m.area } });
  };
  const remove = () => {
    const area = m.area;
    const cfg = { ...s.cfg };
    delete cfg[id];
    api.update({ ...s, cfg, custom: s.custom.filter((c) => c.id !== id), sel: { ...s.sel, [area]: s.sel[area].filter((x) => x !== id) } });
    router.canGoBack() ? router.back() : router.replace({ pathname: '/metas-area', params: { area: m.area } });
  };
  return (
    <MetasScreenFrame title={t('Adjust your target')}>
      <Text style={ms.h2}>{m.custom ? m.custom.name : t(def!.short)}</Text>
      <Text style={ms.sub}>{metaText(m)}</Text>
      {def?.tobacco && (
        <>
          <Text style={ms.label}>{t('You count it in')}</Text>
          <Segmented
            options={(Object.keys(TOBACCO) as TobaccoUnit[]).map((k) => [k, t(TOBACCO[k].label)] as [TobaccoUnit, string])}
            value={draft.unit ?? 'cig'}
            onChange={(u) => setDraft(cfgWithTobaccoUnit(m, draft, u))}
          />
        </>
      )}
      {def?.alcohol && (
        <>
          <Text style={ms.label}>{t('What you count')}</Text>
          <View style={styles.chips}>
            {(Object.keys(ALCOHOL) as AlcoholKind[]).map((k) => (
              <TouchableOpacity key={k} style={[styles.chip, draft.kind === k && styles.chipOn]} onPress={() => setDraft({ ...draft, kind: k })}>
                <Text style={[styles.chipText, draft.kind === k && styles.chipTextOn]}>{t(ALCOHOL[k].label)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
      {!def?.fixedPer && (
        <>
          <Text style={ms.label}>{t('Every')}</Text>
          <Segmented<Per>
            options={[
              ['day', t('Day')],
              ['week', t('Week')],
            ]}
            value={m.per}
            onChange={(p) => setDraft(cfgWithPer(m, draft, p))}
          />
        </>
      )}
      {!(m.kind === 'yesno' && m.per === 'day') && (
        <>
          <Text style={ms.label}>{m.limit ? t('Your limit: less than') : m.kind === 'yesno' ? t('Days a week') : t('Your target')}</Text>
          <TargetStepper m={m} onChange={(tgt) => setDraft({ ...draft, tgt })} />
        </>
      )}
      {m.auto && (
        <>
          <Text style={[ms.label, { marginTop: 14 }]}>{t('How it is filled in')}</Text>
          <View style={{ alignItems: 'flex-start' }}>
            <SourceSwitch m={m} onToggle={() => setDraft({ ...draft, auto: !m.autoOn })} />
          </View>
        </>
      )}
      <TouchableOpacity style={ms.btn} onPress={save}>
        <Text style={ms.btnText}>{t('Save')}</Text>
      </TouchableOpacity>
      {m.custom && (
        <TouchableOpacity style={styles.delete} onPress={remove}>
          <Text style={styles.deleteText}>{t('Delete this target')}</Text>
        </TouchableOpacity>
      )}
    </MetasScreenFrame>
  );
}

// ===== Otra meta (la tuya) =====
export function MetaCustomScreen() {
  const { area } = useLocalSearchParams<{ area?: string }>();
  const a: Area = isArea(area) ? area : 'ej';
  const router = useRouter();
  const api = useMetas();
  const [n, setN] = useState({ name: '', kind: 'yesno' as Kind, per: 'day' as Per, q: 20, days: 5, unit: '' });
  if (!api.data) return <Loading title={t('Other target')} />;
  const s = api.data.state;
  const add = () => {
    const num = Math.max(0, ...s.custom.map((c) => Number(c.id.replace('own-', '')) || 0)) + 1;
    const id = `own-${num}`;
    const amount = n.kind === 'amount';
    const custom = [...s.custom, { id, area: a, name: n.name.trim(), kind: n.kind, unit: amount ? n.unit.trim() : '', max: Math.max(20, n.q * 2) }];
    const cfg = { ...s.cfg, [id]: { tgt: amount ? n.q : n.per === 'week' ? n.days : 1, per: n.per } };
    api.update({ ...s, custom, cfg, sel: { ...s.sel, [a]: [...s.sel[a], id] } });
    router.canGoBack() ? router.back() : router.replace({ pathname: '/metas-elegir', params: { area: a } });
  };
  return (
    <MetasScreenFrame title={t('Other target')}>
      <Text style={ms.sub}>{t('For {area}: a name, how it is counted and how often.', { area: t(AREA_NAME[a]) })}</Text>
      <Text style={ms.label}>{t('Name')}</Text>
      <TextInput
        style={styles.input}
        value={n.name}
        maxLength={40}
        onChangeText={(name) => setN({ ...n, name })}
        placeholder={t('For example, read before bed')}
        placeholderTextColor={Colors.textMuted}
      />
      <Text style={ms.label}>{t('Kind of target')}</Text>
      <Segmented<Kind>
        options={[
          ['yesno', t('Yes / no')],
          ['amount', t('Amount')],
        ]}
        value={n.kind}
        onChange={(kind) => setN({ ...n, kind })}
      />
      {n.kind === 'amount' && (
        <>
          <Text style={ms.label}>{t('How much')}</Text>
          <View style={styles.qRow}>
            <SmallStepper value={n.q} onChange={(q) => setN({ ...n, q })} max={999} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={n.unit}
              maxLength={20}
              onChangeText={(unit) => setN({ ...n, unit })}
              placeholder={t('Unit (optional)')}
              placeholderTextColor={Colors.textMuted}
              accessibilityLabel={t('Unit')}
            />
          </View>
        </>
      )}
      <Text style={ms.label}>{t('How often')}</Text>
      <Segmented<Per>
        options={[
          ['day', t('Every day')],
          ['week', t('Every week')],
        ]}
        value={n.per}
        onChange={(per) => setN({ ...n, per })}
      />
      {n.kind === 'yesno' && n.per === 'week' && (
        <>
          <Text style={ms.label}>{t('Days a week')}</Text>
          <SmallStepper value={n.days} onChange={(days) => setN({ ...n, days })} max={7} />
        </>
      )}
      <View style={[ms.card, { marginTop: 14 }]}>
        <Text style={ms.label}>{t('It will look like this')}</Text>
        <Text style={ms.rowT}>{customText(n)}</Text>
      </View>
      <TouchableOpacity style={[ms.btn, !n.name.trim() && { opacity: 0.4 }]} onPress={add} disabled={!n.name.trim()}>
        <Text style={ms.btnText}>{t('Add')}</Text>
      </TouchableOpacity>
    </MetasScreenFrame>
  );
}

// ===== La (i) de una meta =====
export function MetaInfoScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string }>();
  const id = String(rawId ?? '');
  const api = useMetas();
  const def = CATALOG[id];
  if (!api.data || !def) return <Loading title={t('Information')} />;
  const m = resolveMeta(api.data.state, id)!;
  const serving = SERVING_INFO[id];
  return (
    <MetasScreenFrame title={t('Information')}>
      <Text style={ms.h2}>{t(def.short)}</Text>
      <Text style={ms.sub}>{t('Your target: {text}', { text: lowerFirst(metaText(m)) })}</Text>
      {serving && (
        <View style={ms.card}>
          <Text style={ms.label}>{t(serving[0])}</Text>
          <Text style={ms.p}>{t(serving[1])}</Text>
        </View>
      )}
      <View style={ms.card}>
        <Text style={ms.label}>{t('What is studied')}</Text>
        {(META_EVIDENCE[id] ?? []).map(([level, text]) => (
          <View key={text} style={styles.ev}>
            <Text style={styles.evLevel}>{t(level)}</Text>
            <Text style={ms.p}>{t(text)}</Text>
          </View>
        ))}
      </View>
      <Text style={ms.meta}>{t('What happens in general, not what will happen to you.')}</Text>
    </MetasScreenFrame>
  );
}

// ===== Tu compromiso =====
export function MetasCommitScreen() {
  const router = useRouter();
  const api = useMetas();
  const [weeks, setWeeks] = useState<number | null>(null);
  // Recién firmado aquí: se ofrece ir a marcar los hábitos de hoy (fundador, 2026-11-16)
  const [signedNow, setSignedNow] = useState(false);
  if (!api.data) return <Loading title={t('Your commitment')} />;
  const s = api.data.state;
  const w = weeks ?? s.commit?.weeks ?? 8;
  // Hábitos si tiene alguno; si no, la primera área con metas
  const markArea: Area | undefined = s.sel.ha.length ? 'ha' : AREAS.find((a) => s.sel[a].length > 0);
  if (!selectedIds(s).length)
    return (
      <MetasScreenFrame title={t('Your commitment')}>
        <Text style={ms.sub}>{t('Choose your targets first.')}</Text>
        <TouchableOpacity style={ms.btn} onPress={() => router.replace({ pathname: '/metas-elegir', params: { area: 'ej' } })}>
          <Text style={ms.btnText}>{t('Choose your targets')}</Text>
        </TouchableOpacity>
      </MetasScreenFrame>
    );
  const pickWeeks = (n: number) => {
    setWeeks(n);
    if (s.commit) api.update({ ...s, commit: { ...s.commit, weeks: n } });
  };
  return (
    <MetasScreenFrame title={t('Your commitment')}>
      <Text style={[ms.h2, { marginBottom: 10 }]}>{t('I commit to…')}</Text>
      {AREAS.filter((a) => s.sel[a].length).map((a) => (
        <View key={a} style={ms.card}>
          <Text style={[ms.label, { color: AREA_COLOR[a], marginTop: 0 }]}>{t(AREA_NAME[a])}</Text>
          {s.sel[a].map((id) => {
            const m = resolveMeta(s, id);
            return m ? (
              <View key={id} style={styles.bul}>
                <Text style={styles.bulDot}>•</Text>
                <Text style={[ms.p, { flex: 1 }]}>{metaText(m)}</Text>
              </View>
            ) : null;
          })}
        </View>
      ))}
      <Text style={ms.label}>{t('For')}</Text>
      <View style={styles.chips}>
        {[4, 8, 12].map((n) => (
          <TouchableOpacity key={n} style={[styles.chip, w === n && styles.chipOn]} onPress={() => pickWeeks(n)}>
            <Text style={[styles.chipText, w === n && styles.chipTextOn]}>{t('{n} weeks', { n })}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {s.commit ? (
        <>
          <View style={[ms.btn, styles.signed]}>
            <Ionicons name="checkmark" size={18} color={Colors.ok} />
            <Text style={[ms.btnText, { color: Colors.ok }]}>{t('Commitment signed')}</Text>
          </View>
          {signedNow && markArea && (
            <View style={styles.markNow}>
              <Text style={styles.markNowText}>
                {markArea === 'ha' ? t('Shall we mark today’s habits now?') : t('Shall we mark today now?')}
              </Text>
              <TouchableOpacity
                style={[ms.btn, styles.markNowBtn]}
                onPress={() => router.replace({ pathname: '/metas-area', params: { area: markArea } })}
                activeOpacity={0.85}
              >
                <Text style={ms.btnText}>{t('Go to {area}', { area: t(AREA_NAME[markArea]) })}</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <TouchableOpacity
          style={ms.btn}
          onPress={() => {
            setSignedNow(true);
            api.update({ ...s, commit: { day: api.today, weeks: w }, closedWeek: null });
          }}
        >
          <Text style={ms.btnText}>{t('I commit')}</Text>
        </TouchableOpacity>
      )}
      <Text style={ms.meta}>{commitNote(s, api.days, api.today)}</Text>
    </MetasScreenFrame>
  );
}

// La semana va de lunes a domingo (o de domingo a sábado, en Ajustes); si firmas a mitad, la primera
// cuenta desde ese día y sus metas a la semana van en proporción
function commitNote(s: MetasState, days: string[], today: string): string {
  const first = days.length ? weekdayName(days[0]) : '';
  const last = days.length ? weekdayName(days[6]) : '';
  if (s.commit)
    return t('Signed on {date}. Your weeks go from {first} to {last} (you can change it in Settings); the first one counted from the day you signed.', {
      date: dayMonth(s.commit.day),
      first,
      last,
    });
  return days[0] === today
    ? t('Your week starts today and ends on {last}. What comes from your watch fills in by itself; the rest you mark in each area. You can change a target whenever you want.', { last })
    : t('You start today: your first week ends on {last}, so its weekly targets go in proportion. What comes from your watch fills in by itself; the rest you mark in each area. You can change a target whenever you want.', { last });
}

const styles = StyleSheet.create({
  goal: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  areaHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  areaName: { flex: 1, fontSize: 15, fontWeight: '800' },
  areaPct: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  areaRow: { marginTop: 10, gap: 2 },
  areaRowT: { color: Colors.textPrimary, fontSize: 14 },
  areaRowP: { color: Colors.textMuted, fontSize: 12.5 },
  commitLink: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 10 },
  quickHead: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12 },
  quickHeadLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider },
  quickEmpty: { color: Colors.textMuted, fontSize: 13, paddingBottom: 12 },
  lastRow: { borderBottomWidth: 0 },
  manyTip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: Colors.accentSoft, borderRadius: 12, padding: 12, marginBottom: 12 },
  manyTipText: { flex: 1, color: Colors.textPrimary, fontSize: 13.5, lineHeight: 19 },
  bigRing: { alignItems: 'center', marginVertical: 12 },
  weekBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  weekArrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
  weekTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  weekRange: { color: Colors.textMuted, fontSize: 12, marginTop: 1 },
  weekNote: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, textAlign: 'center', marginBottom: 12, paddingHorizontal: 8 },
  tags: { flexDirection: 'row', gap: 6 },
  tagOwn: { color: Colors.violet, backgroundColor: Colors.violetSoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: Colors.background, fontWeight: '800' },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  delete: { alignItems: 'center', paddingVertical: 14 },
  deleteText: { color: Colors.danger, fontSize: 14, fontWeight: '700' },
  ev: { gap: 4, marginTop: 8 },
  evLevel: { color: Colors.accent, fontSize: 12, fontWeight: '800' },
  bul: { flexDirection: 'row', gap: 8, marginTop: 4 },
  bulDot: { color: Colors.textMuted, fontSize: 14, lineHeight: 20 },
  signed: { flexDirection: 'row', justifyContent: 'center', gap: 6, backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.ok },
  markNow: { marginTop: 18, alignItems: 'center' },
  markNowText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  markNowBtn: { alignSelf: 'stretch', marginTop: 10 },
});
