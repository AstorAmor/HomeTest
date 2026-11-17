// Pantallas de objetivos y metas (prototipo v3, 2026-11-04). Rutas en src/app/metas*.tsx; lógica en
// src/logic/metas.ts; datos en src/hooks/useMetas.ts. Desde el 2026-11-16, con el aspecto del prototipo de las
// 4 pestañas (borradores/app-estructura/prototipo; ESPECIFICACION.md §7). El fundador: «los submenús de
// ejercicio, hábitos, alimentación… déjalo muy próximo a lo que me habías enseñado». Cada área: la cifra grande
// de la semana, su línea cometa y una sola lista de metas con sus 7 días; cada meta (al tocar su nombre): la
// cifra de ahora, su historia con la meta en línea de puntos, sus 7 días y dos números.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMetas, type MetasApi } from '@/hooks/useMetas';
import { SERVING_INFO, META_EVIDENCE } from '@/data/metasInfo';
import { showSamples } from '@/data/dataMode';
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
  addDays,
  areaScore,
  cfgWithPer,
  cfgWithTobaccoUnit,
  customText,
  dayMonth,
  defaultCfg,
  evalMeta,
  fmtMeta,
  goalAllowed,
  labGoalText,
  metaAllowed,
  metaText,
  pickList,
  progressText,
  r2,
  rangeText,
  recommended,
  resolveMeta,
  selectedIds,
  sortGoals,
  sourceText,
  toggleSel,
  tooMany,
  unitWord,
  valuesFor,
  weekStartOf,
  weekdayName,
  type AlcoholKind,
  type Area,
  type DayMap,
  type GoalKey,
  type Kind,
  type Meta,
  type MetaCfg,
  type MetasState,
  type Per,
  type TobaccoUnit,
} from '@/logic/metas';
import {
  AREA_COLOR,
  AREA_RING,
  CelebratePct,
  Checkbox,
  MetaRow,
  MetaWeek,
  PartyOverlay,
  type Party,
  MetasScreenFrame,
  Segmented,
  SmallStepper,
  SourceSwitch,
  TargetStepper,
  metaName,
  metaStyles as ms,
} from '@/components/metas/MetaParts';
import { MetaChart } from '@/components/metas/MetaChart';
import { CometLine } from '@/components/CometLine';
import { FRow, SecHead, Tag } from '@/components/fine/Fine';
import { t } from '@/i18n';
import { planVersionRepository } from '@/data/planVersions';
import { specialistPlans } from '@/logic/specialistPlan';
import { FINE, ff, fine } from '@/theme/fine';

const isArea = (a: unknown): a is Area => typeof a === 'string' && (AREAS as string[]).includes(a);
const lowerFirst = (s: string) => (/^[A-ZÁÉÍÓÚ][a-záéíóúñ ]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const pctText = (f: number | null) => (f == null ? '—' : `${Math.round(f * 100)} %`);

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

  const goalRow = (g: GoalKey) => {
    const lg = lab.find((x) => x.key === g);
    return <FRow key={g} title={t(GOALS[g].name)} sub={[lg ? labGoalText(lg) : null, t(GOALS[g].track)].filter(Boolean).join(' ')} />;
  };

  return (
    <MetasScreenFrame title={t('Your goals')}>
      {rec.length > 0 && <SecHead title={t('Recommended for you')} style={styles.firstSec} />}
      {rec.map(goalRow)}
      {own.length > 0 && <SecHead title={t('Your own')} style={!rec.length && styles.firstSec} />}
      {own.map(goalRow)}
      {!s.goals.length && <Text style={ms.sub}>{t('You have no goals yet.')}</Text>}
      <TouchableOpacity style={ms.btnSoft} onPress={() => router.push('/metas-objetivos')}>
        <Text style={ms.btnSoftText}>{t('Change my goals')}</Text>
      </TouchableOpacity>

      <SecHead title={t('Your action areas')} />
      {AREAS.map((a) => {
        const f = areaScore(s, a, api.vals, api.week ?? undefined, api.known);
        return (
          <TouchableOpacity
            key={a}
            style={styles.area}
            activeOpacity={0.8}
            onPress={() => router.push(s.sel[a].length ? { pathname: '/metas-area', params: { area: a } } : { pathname: '/metas-elegir', params: { area: a } })}
            accessibilityRole="button"
          >
            {/* Como en Hoy: el nombre en marfil y el % apagado; el color va en la línea */}
            <View style={styles.areaHead}>
              <Text style={styles.areaName}>{t(AREA_NAME[a])}</Text>
              <Text style={styles.areaPct}>{pctText(f)}</Text>
            </View>
            <CometLine progress={f ?? 0} colors={AREA_RING[a]} thickness={4} style={styles.areaLine} />
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
              <Text style={styles.areaRowP}>{t('No targets')}</Text>
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
  return <FRow title={t('Your specialist’s plan')} sub={t('Sent on {date}', { date: dayMonth(latest.slice(0, 10)) })} onPress={() => router.push('/plans')} style={styles.topLine} />;
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
      <Ionicons name="checkmark-circle-outline" size={16} color={FINE.jade} />
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
      </View>
    );
  };
  // Un objetivo de la analítica que ya no sale recomendado pero sigue elegido, también se puede quitar
  const labShown = LAB_GOALS.filter((g) => recKeys.includes(g) || s.goals.includes(g));
  return (
    <MetasScreenFrame title={t('Your goals')}>
      <Text style={ms.sub}>{t('Up to {n}. Change them whenever you want.', { n: GOALS_MAX })}</Text>
      <SecHead title={t('Recommended by your blood test')} style={styles.firstSec} />
      {labShown.length ? <View style={ms.cardList}>{labShown.map(row)}</View> : <Text style={ms.meta}>{t('Your blood test does not point to any goal for now.')}</Text>}
      <SecHead title={t('Add your own')} />
      <View style={ms.cardList}>{OWN_GOALS.filter((g) => goalAllowed(g, who) || s.goals.includes(g)).map(row)}</View>
      <Text style={ms.meta}>{t('{n} of {max}. With the ones you choose, we recommend targets in each area.', { n: s.goals.length, max: GOALS_MAX })}</Text>
      {/* Las metas, aquí mismo, debajo de los objetivos (fundador, 2026-11-06): las que tienes y las que
          recomiendan los objetivos que eliges, que cambian al marcar uno. «Ver todas», a las del área. */}
      <SecHead title={t('Your targets')} />
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
      <Ionicons name="bulb-outline" size={17} color={FINE.mute} />
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
      <SecHead title={t(AREA_NAME[a])} more={t('See all')} onMore={() => router.push({ pathname: '/metas-elegir', params: { area: a } })} style={styles.areaSec} />
      {ids.map((id) => {
        const m = resolveMeta(s, id);
        if (!m) return null;
        const on = sel.includes(id);
        return (
          <View key={id} style={ms.row}>
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

// ===== Un área: la cifra de la semana, su línea cometa y sus metas con sus 7 días =====
// Como el prototipo (`area`): «39 %» grande y ligero, «de tu semana» y las fechas al lado, la línea cometa en el
// color del área, «ESTA SEMANA» y una sola lista de metas. Se puede ir a la semana pasada (para apuntar el
// domingo el lunes, por ejemplo) desde el enlace de la cabecera de la lista.
export function MetasAreaScreen() {
  const router = useRouter();
  const { area } = useLocalSearchParams<{ area?: string }>();
  const a: Area = isArea(area) ? area : 'ej';
  const api = useMetas();
  // La semana en curso o la pasada
  const [offset, setOffset] = useState(0);
  const { weekView } = api;
  const view = useMemo(() => weekView(offset), [weekView, offset]);
  // Al llegar al 100 % marcando (en la semana en curso): la cifra celebra y salta el confeti
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
  const ids = s.sel[a];
  return (
    <MetasScreenFrame title={t(AREA_NAME[a])} overlay={<PartyOverlay party={party} />}>
      <View style={styles.big}>
        <CelebratePct area={a} score={f} allDone={allDone} armed={armed} onParty={onParty} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bigSide}>{t(offset === 0 ? 'of your week' : 'of last week')}</Text>
          <Text style={styles.bigSide}>{rangeText(days[0], days[6])}</Text>
        </View>
      </View>
      <CometLine progress={f ?? 0} colors={AREA_RING[a]} thickness={4} style={styles.comet} />
      {first && (
        <Text style={fine.note}>
          {t('Your first week counts from {day}: weekly targets go in proportion.', { day: `${weekdayName(days[week.from])} ${dateOfDay(days[week.from])}` })}
        </Text>
      )}
      <SecHead
        title={t(offset === 0 ? 'This week' : 'Last week')}
        more={canBack ? t('Last week') : offset !== 0 ? t('This week') : undefined}
        onMore={() => setOffset(offset === 0 ? -1 : 0)}
      />
      {ids.length ? (
        ids.map((id) => {
          const m = resolveMeta(s, id);
          if (!m) return null;
          return (
            <MetaRow
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
            />
          );
        })
      ) : (
        <Text style={ms.sub}>{t('You have no targets here.')}</Text>
      )}
      {ids.length > 0 && (
        <Text style={fine.note}>
          {offset === 0
            ? t('Tap a day to mark or correct it. Today is the one with the ring. Tap the name to see how it is going.')
            : t('Tap a day to mark or correct it. Tap the name to see how it is going.')}
        </Text>
      )}
      <TouchableOpacity style={ms.btnSoft} onPress={() => router.push({ pathname: '/metas-elegir', params: { area: a } })} accessibilityRole="button">
        <Text style={ms.btnSoftText}>{t('+ Add target')}</Text>
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
      <Text style={[ms.sub, { marginTop: 8 }]}>{t('The recommended ones come from your goals.')}</Text>
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
                  <Ionicons name="information-circle-outline" size={20} color={FINE.mute} />
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
      <Text style={ms.h2}>{metaName(m)}</Text>
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
          <Segmented
            options={(Object.keys(ALCOHOL) as AlcoholKind[]).map((k) => [k, t(ALCOHOL[k].label)] as [AlcoholKind, string])}
            value={draft.kind ?? 'beer'}
            onChange={(k) => setDraft({ ...draft, kind: k })}
          />
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
          <Text style={ms.label}>{t('How it is filled in')}</Text>
          <View style={{ alignItems: 'flex-start' }}>
            <SourceSwitch m={m} onToggle={() => setDraft({ ...draft, auto: !m.autoOn })} />
          </View>
        </>
      )}
      <TouchableOpacity style={ms.btn} onPress={save} accessibilityRole="button">
        <Text style={ms.btnText}>{t('Save')}</Text>
      </TouchableOpacity>
      {m.custom && (
        <TouchableOpacity style={styles.delete} onPress={remove} accessibilityRole="button">
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
  const ready = !!n.name.trim();
  return (
    <MetasScreenFrame title={t('Other target')}>
      <Text style={ms.sub}>{t('For {area}: a name, how it is counted and how often.', { area: t(AREA_NAME[a]) })}</Text>
      <Text style={[ms.label, { marginTop: 8 }]}>{t('Name')}</Text>
      <TextInput
        style={styles.input}
        value={n.name}
        maxLength={40}
        onChangeText={(name) => setN({ ...n, name })}
        placeholder={t('For example, read before bed')}
        placeholderTextColor={FINE.mute}
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
              placeholderTextColor={FINE.mute}
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
      <Text style={ms.label}>{t('It will look like this')}</Text>
      <View style={styles.preview}>
        <Text style={ms.rowT}>{customText(n)}</Text>
      </View>
      <TouchableOpacity style={[ms.btn, !ready && { opacity: 0.4 }]} onPress={add} disabled={!ready} accessibilityRole="button" accessibilityState={{ disabled: !ready }}>
        <Text style={ms.btnText}>{t('Add')}</Text>
      </TouchableOpacity>
    </MetasScreenFrame>
  );
}

// ===== Una meta: cómo va y su (i) =====
// Si la tienes elegida (ESPECIFICACION.md §7, «Meta»: siempre igual): la cifra de ahora con su unidad y tu meta,
// su historia en esa unidad con la meta en línea de puntos, sus 7 días y dos números (la media y de dónde
// partías); después, ajustarla y de dónde llega. Debajo, lo de su (i): qué cuenta como una y lo que está
// estudiado. Si no la tienes (desde «Tus metas»), solo la (i).
export function MetaInfoScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string }>();
  const id = String(rawId ?? '');
  const api = useMetas();
  const m = api.data ? resolveMeta(api.data.state, id) : null;
  if (!api.data || !m) return <Loading title={t('Information')} />;
  const selected = api.data.state.sel[m.area].includes(id);
  const serving = SERVING_INFO[id];
  const evidence = META_EVIDENCE[id] ?? [];
  return (
    <MetasScreenFrame title={metaName(m)}>
      {selected ? <MetaNow api={api} m={m} /> : <Text style={ms.sub}>{t('Your target: {text}', { text: lowerFirst(metaText(m)) })}</Text>}
      {serving && (
        <>
          <SecHead title={t(serving[0])} style={!selected && styles.firstSec} />
          <Text style={ms.p}>{t(serving[1])}</Text>
        </>
      )}
      {evidence.length > 0 && (
        <>
          <SecHead title={t('What is studied')} style={!selected && !serving && styles.firstSec} />
          {evidence.map(([level, text]) => (
            <View key={text} style={styles.ev}>
              <Tag label={t(level)} />
              <Text style={ms.p}>{t(text)}</Text>
            </View>
          ))}
          <Text style={fine.note}>{t('What happens in general, not what will happen to you.')}</Text>
        </>
      )}
    </MetasScreenFrame>
  );
}

// La historia de una meta en su unidad (ESPECIFICACION.md §8: «de sus lecturas guardadas, agrupadas por día o por
// semana»), con lo mismo que el resto de la app (lo apuntado a mano y lo que llega solo): las de cantidad al día,
// lo de cada uno de los últimos 14 días; las demás, lo de cada una de las últimas 8 semanas (la en curso, al
// final). Un día o una semana sin ningún dato queda vacío (no cuenta como 0).
function metaHistory(s: MetasState, m: Meta, manual: DayMap, auto: DayMap, today: string, demoToday?: string) {
  const daily = m.per === 'day' && m.kind === 'amount';
  if (daily) {
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
    const v = valuesFor(s, days, manual, auto, demoToday)[m.id] ?? [];
    return { daily, points: days.map((_, i) => (v[i] == null ? null : r2(v[i]! / m.f))), goal: m.tgt };
  }
  const first = weekStartOf(today, s.weekStart);
  const points = Array.from({ length: 8 }, (_, k) => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(first, (k - 7) * 7 + i));
    const v = valuesFor(s, days, manual, auto, demoToday)[m.id] ?? [];
    if (!v.some((x) => x != null)) return null;
    return m.kind === 'yesno' ? v.filter((x) => x === 1).length : r2(v.reduce<number>((acc, x) => acc + (x ?? 0), 0) / m.f);
  });
  // Un sí / no de cada día: cuántos días de cada semana, con la meta en los 7
  return { daily, points, goal: m.per === 'day' ? 7 : m.tgt };
}

function MetaNow({ api, m }: { api: MetasApi; m: Meta }) {
  const router = useRouter();
  const view = api.weekView(0);
  if (!api.data || !view) return null;
  const { week, days, vals, known } = view;
  const v7 = vals[m.id] ?? Array(7).fill(null);
  const e = evalMeta(m, v7, week, known[m.id]);
  const T = week.current ? week.to : -1;
  const color = AREA_COLOR[m.area];

  // La cifra de ahora: lo de hoy en las de cantidad al día; si no, lo que llevas esta semana
  let big: string;
  let side: string;
  if (m.per === 'day' && m.kind === 'amount') {
    const v = T >= 0 ? v7[T] : null;
    const x = v == null ? null : Math.round((v / m.f) * 10) / 10; // con un decimal como mucho (7,62 h → 7,6)
    big = x == null ? '—' : fmtMeta(m, x);
    const u = unitWord(m, x ?? m.tgt);
    side = (m.id === 'dormir' ? t('{unit} last night', { unit: u }) : t('{unit} today', { unit: u })).trim();
  } else if (m.per === 'day') {
    big = String(e.n);
    side = t('{unit} this week', { unit: unitWord(m, e.n) }).trim();
  } else {
    const x = r2(e.sum / m.f);
    big = fmtMeta(m, x);
    side = t('{unit} this week', { unit: unitWord(m, x) }).trim();
  }

  const hist = metaHistory(api.data.state, m, api.data.manual, api.auto, api.today, showSamples() ? api.today : undefined);
  const pts = hist.points;
  const have = pts.filter((x): x is number => x != null);
  const avg = have.length ? have.reduce((acc, x) => acc + x, 0) / have.length : null;
  const firstIdx = pts.findIndex((x) => x != null);
  const ago = firstIdx < 0 ? 0 : pts.length - 1 - firstIdx;
  const round = (x: number) => (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10);
  const withUnit = (x: number) => `${fmtMeta(m, round(x))} ${unitWord(m, round(x))}`.trim();
  const u = unitWord(m, 2);
  const unitPhrase = u ? (hist.daily ? t('{q} a day', { q: u }) : t('{q} a week', { q: u })) : '';
  const span = hist.daily
    ? unitPhrase
      ? t('The last 14 days, in {unit}.', { unit: unitPhrase })
      : t('The last 14 days.')
    : unitPhrase
      ? t('The last 8 weeks, in {unit}.', { unit: unitPhrase })
      : t('The last 8 weeks.');
  const goalNote = m.limit ? t('The dotted line is your limit.') : t('The dotted line is your target.');
  let agoLabel = '';
  if (hist.daily) agoLabel = ago === 1 ? t('Yesterday') : t('{n} days ago', { n: ago });
  else agoLabel = ago === 1 ? t('Last week') : t('{n} weeks ago', { n: ago });

  return (
    <>
      <View style={styles.big}>
        <Text style={styles.bigNum}>{big}</Text>
        <View style={{ flex: 1 }}>
          {side ? <Text style={styles.bigSide}>{side}</Text> : null}
          <Text style={styles.bigSide}>{t('Your target: {text}', { text: lowerFirst(metaText(m)) })}</Text>
        </View>
      </View>
      {have.length > 1 ? (
        <>
          <MetaChart values={pts} color={color} goal={hist.goal} />
          <Text style={fine.note}>{`${span} ${goalNote}`}</Text>
        </>
      ) : (
        <Text style={[fine.note, { marginTop: 14 }]}>{t('Its history shows here as more data comes in.')}</Text>
      )}

      <SecHead title={t('This week')} />
      <MetaWeek
        m={m}
        vals={v7}
        autoVals={days.map((d) => api.auto[m.id]?.[d] ?? null)}
        fixed={days.map((d) => api.data?.manual[m.id]?.[d] != null)}
        days={days}
        week={week}
        known={known[m.id]}
        color={color}
        onSet={(day, v) => api.setValue(m, day, v)}
      />
      <Text style={fine.note}>{t('Tap a day to mark or correct it.')}</Text>

      <SecHead title={t('In numbers')} />
      {avg != null && <FRow title={hist.daily ? t('Average of the last 14 days') : t('Average of the last 8 weeks')} value={withUnit(avg)} />}
      {ago > 0 && <FRow title={agoLabel} value={withUnit(pts[firstIdx]!)} />}
      <FRow title={t('Adjust your target')} sub={metaText(m)} onPress={() => router.push({ pathname: '/metas-ajustar', params: { id: m.id } })} last={!m.auto} />
      {m.auto && <FRow title={t('How it is filled in')} right={<SourceSwitch m={m} onToggle={() => toggleSource(api, m.id)} />} last />}
    </>
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
      <Text style={ms.h2}>{t('I commit to…')}</Text>
      {AREAS.filter((a) => s.sel[a].length).map((a) => (
        <View key={a}>
          <SecHead title={t(AREA_NAME[a])} style={styles.commitSec} />
          {s.sel[a].map((id) => {
            const m = resolveMeta(s, id);
            return m ? <FRow key={id} title={metaText(m)} /> : null;
          })}
        </View>
      ))}
      <Text style={ms.label}>{t('For')}</Text>
      <Segmented options={[4, 8, 12].map((n) => [String(n), t('{n} weeks', { n })] as [string, string])} value={String(w)} onChange={(k) => pickWeeks(Number(k))} />
      {s.commit ? (
        <>
          <View style={styles.signed}>
            <Ionicons name="checkmark" size={17} color={FINE.jade} />
            <Text style={styles.signedText}>{t('Commitment signed')}</Text>
          </View>
          {signedNow && markArea && (
            <View style={styles.markNow}>
              <Text style={styles.markNowText}>{markArea === 'ha' ? t('Shall we mark today’s habits now?') : t('Shall we mark today now?')}</Text>
              <TouchableOpacity style={[ms.btn, { marginTop: 12 }]} onPress={() => router.replace({ pathname: '/metas-area', params: { area: markArea } })} activeOpacity={0.85}>
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
      <Text style={[fine.note, { marginTop: 16 }]}>{commitNote(s, api.days, api.today)}</Text>
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
  firstSec: { marginTop: 8 },
  topLine: { borderTopWidth: 1, borderTopColor: FINE.line, marginTop: 20 },
  // Un área en «Tus objetivos», como en Hoy
  area: { paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: FINE.line },
  areaHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  areaName: { ...ff('medium'), flex: 1, fontSize: 15, color: FINE.ivory },
  areaPct: { ...ff('regular'), color: FINE.mute, fontSize: 14, fontVariant: ['tabular-nums'] },
  areaLine: { marginTop: 4, marginRight: -6, marginBottom: 4 },
  areaRow: { marginTop: 6, gap: 1 },
  areaRowT: { ...ff('regular'), color: FINE.ivory, fontSize: 14, lineHeight: 19 },
  areaRowP: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 17 },
  commitLink: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 14 },
  areaSec: { marginTop: 22 },
  quickEmpty: { ...ff('regular'), color: FINE.mute, fontSize: 13, paddingVertical: 10 },
  manyTip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 12, marginVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: FINE.line },
  manyTipText: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 13.5, lineHeight: 19 },
  // La cifra grande de un área o de una meta, con lo suyo al lado (prototipo, `.big`)
  big: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  bigNum: { ...ff('light'), color: FINE.ivory, fontSize: 44, lineHeight: 50, fontVariant: ['tabular-nums'] },
  bigSide: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 18 },
  comet: { marginTop: 10, marginHorizontal: -6 },
  tags: { flexDirection: 'row', gap: 6 },
  tagOwn: { color: FINE.mute, borderColor: FINE.line },
  input: {
    ...ff('regular'),
    backgroundColor: FINE.tile,
    borderWidth: 1,
    borderColor: FINE.line,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: FINE.ivory,
    fontSize: 15,
  },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  preview: { paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: FINE.line },
  delete: { alignSelf: 'center', paddingVertical: 14, marginTop: 4 },
  deleteText: { ...ff('regular'), color: FINE.mute, fontSize: 14 },
  ev: { gap: 6, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: FINE.line, alignItems: 'flex-start' },
  // Sin la línea de sección: con la de debajo de la última meta del área quedaban dos seguidas; solo la fina entre
  // metas (fundador, 2026-11-17)
  commitSec: { marginTop: 18, borderTopWidth: 0, paddingTop: 0, minHeight: 0 },
  signed: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    minHeight: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FINE.jadeLine,
  },
  signedText: { ...ff('medium'), color: FINE.jade, fontSize: 14 },
  markNow: { marginTop: 22, alignItems: 'center' },
  markNowText: { ...ff('medium'), color: FINE.ivory, fontSize: 15, textAlign: 'center' },
});
