import { currentReport } from '@/data/reportRepository';
import { getActionPlanContentEn } from '@/data/reportContentEn';
import { PlanVersion, PlanVersionItem } from '@/data/planVersions';
import { MarkerChange, ProgressResult } from './progress';
import { showSamples } from '@/data/dataMode';
import type { PlanItem } from '@/logic/plan';
import { num, t } from '@/i18n';

// Propone un plan actualizado a partir de lo que ha cambiado en una analítica nueva.
// - Acción cuyos marcadores no se han vuelto a medir → se queda igual ("not retested").
// - Todos sus marcadores medidos ya en rango → objetivo conseguido: se mantiene como hábito.
// - Mejorando → "on track"; sin cambio o peor → "needs attention" (y se sugiere hablar
//   con un profesional).
// - Marcador que ahora está fuera de rango y ninguna acción lo trabaja → acción nueva
//   de la biblioteca de abajo (texto general, revisable por un médico de HomeTest).
// Es una propuesta: el usuario la aplica y queda como versión nueva del plan.

type BaseItem = Omit<PlanVersionItem, 'status' | 'note'>;

// Plan vigente: la última versión guardada o, si no hay, el plan personalizado (el de Hoy). Sus acciones
// son hábitos, no van atadas a marcadores: lo que la analítica saque fuera de rango llega como acción
// nueva. El action plan del informe de ejemplo solo cuenta en las cuentas de prueba.
export function basePlanItems(latest: PlanVersion | null, goalsPlan: PlanItem[] = []): BaseItem[] {
  if (latest) return latest.items.map(({ title, why, markers }) => ({ title, why, markers }));
  if (!showSamples()) return goalsPlan.map((it) => ({ title: it.title, why: it.why, markers: [] }));
  return currentReport.action_plan.map((a) => {
    const en = getActionPlanContentEn(a.action_id, { title: a.title, why: a.why, how: a.how, caveats: a.caveats });
    const markers = Array.from(new Set([...(a.linked_markers ?? []), a.estimated_next_test?.marker_id].filter(Boolean) as string[]));
    return { title: en.title, why: en.why.join(' '), markers };
  });
}

const fmt = (c: MarkerChange) => `${c.name} ${num(c.before)} → ${num(c.after)} ${c.unit}`.trim();

interface Rule {
  markers: string[];
  family: string; // cómo se llama el grupo en las gráficas del plan ("Colesterol")
  title: string;
  why: string; // vale para cualquier marcador del grupo
  // Lo que se añade solo si uno de esos marcadores es el que hay que trabajar: así quien tiene alto el
  // colesterol total no lee que el ejercicio sube el HDL. Palancas de la guía ESC/EAS 2019 de
  // dislipemias (tabla de intervenciones de estilo de vida): grasa saturada y fibra para el LDL, peso,
  // alcohol y azúcares para los triglicéridos, actividad física para el HDL; la Lp(a) es genética.
  notes?: { markers: string[]; text: string }[];
}

const RULES: Rule[] = [
  { markers: ['glucose', 'hba1c', 'insulin', 'homa_ir', 'fructosamine'], family: 'Blood sugar', title: 'A 10-minute walk after each main meal', why: 'Vegetables and protein first, whole grains instead of refined ones, and water instead of sugary drinks.' },
  {
    markers: ['ldl', 'apob', 'total_cholesterol', 'non_hdl_cholesterol', 'triglycerides', 'hdl', 'lpa'],
    family: 'Cholesterol',
    title: 'Olive oil, nuts, and oily fish 2–3 times a week',
    why: 'Fibre every day (legumes, oats, fruit), and processed meat, butter and pastries only occasionally.',
    notes: [
      { markers: ['ldl', 'apob', 'total_cholesterol', 'non_hdl_cholesterol'], text: 'Swapping that saturated fat for olive oil and nuts, plus the fibre, is what lowers LDL and total cholesterol the most.' },
      { markers: ['triglycerides'], text: 'Triglycerides come down most with less sugar, refined flour and alcohol, and with regular exercise.' },
      { markers: ['hdl'], text: '30 minutes of movement a day is what raises HDL the most, although it rises slowly.' },
      { markers: ['lpa'], text: 'Lp(a) is mostly genetic and barely changes with lifestyle: review it with a doctor.' },
    ],
  },
  { markers: ['ferritin', 'iron', 'transferrin_saturation', 'hemoglobin', 'tibc'], family: 'Iron', title: 'Iron-rich foods with vitamin C, 4–5 days a week', why: 'Red meat, legumes or spinach with citrus or peppers in the same meal. Talk to a doctor before taking supplements.' },
  { markers: ['vitamin_d'], family: 'Vitamin D', title: '15 minutes of midday sun most days', why: 'And oily fish twice a week. Ask a doctor whether you need a supplement.' },
  { markers: ['vitamin_b12', 'folate'], family: 'Vitamin B12 and folate', title: 'Eggs, fish or dairy every day', why: 'Plus leafy greens. A doctor can tell you if you need a supplement.' },
  { markers: ['alt', 'ast', 'ggt'], family: 'Liver', title: 'At least 4 alcohol-free days a week', why: 'Water instead of sugary drinks, and a healthy weight.' },
  { markers: ['hs_crp', 'esr', 'fibrinogen'], family: 'Inflammation', title: '7 hours of sleep and 30 minutes of movement a day', why: 'Oily fish twice a week also helps bring inflammation markers down.' },
  { markers: ['uric_acid', 'creatinine', 'egfr', 'cystatin_c'], family: 'Kidneys and uric acid', title: '1.5–2 litres of water a day', why: 'Alcohol, sugary drinks and very salty food only occasionally.' },
];

// Texto que se guardaba antes en los planes para el colesterol (decía a todos que el ejercicio sube el
// HDL): los planes guardados con él lo enseñan ya ajustado a sus marcadores (ver ruleWhyForItem)
const LEGACY_WHY: Record<string, string> = {
  'Fibre every day (legumes, oats, fruit), processed meat and pastries only occasionally, and 30 minutes of movement a day, which raises HDL.': 'Cholesterol',
  'Fibra todos los días (legumbres, avena, fruta), embutido y bollería solo de vez en cuando, y 30 minutos de movimiento al día, que sube el HDL.': 'Cholesterol',
};

const DOCTOR_RULE: Omit<Rule, 'markers' | 'family'> = {
  title: 'Review this result with a doctor',
  why: 'This marker is out of range and needs a professional look before changing anything.',
};

export interface PlanRule {
  family: string;
  title: string;
  why: string;
}

const ruleText = (rule: Rule, markerIds: string[]): PlanRule => ({
  family: t(rule.family),
  title: t(rule.title),
  why: [rule.why, ...(rule.notes ?? []).filter((n) => n.markers.some((m) => markerIds.includes(m))).map((n) => n.text)]
    .map((s) => t(s))
    .join(' '),
});

// Qué acción del plan trabaja unos marcadores de la misma familia ("Colesterol": aceite de oliva… y qué
// hacer, con lo propio de esos marcadores), traducida; null si ninguna (toca revisarlo con un médico)
export function planRuleForMarkers(markerIds: string[]): PlanRule | null {
  const rule = RULES.find((r) => markerIds.some((m) => r.markers.includes(m)));
  return rule ? ruleText(rule, markerIds) : null;
}

export const planRuleForMarker = (markerId: string) => planRuleForMarkers([markerId]);

// El porqué de una acción guardada; si es el texto antiguo del colesterol, el de ahora para sus marcadores
export function ruleWhyForItem(item: { why: string; markers: string[] }): string {
  const family = LEGACY_WHY[item.why];
  const rule = family ? RULES.find((r) => r.family === family) : undefined;
  return rule ? ruleText(rule, item.markers).why : item.why;
}

export interface PlanProposal {
  items: PlanVersionItem[];
  counts: Record<PlanVersionItem['status'], number>;
}

export function proposeUpdatedPlan(base: BaseItem[], progress: ProgressResult): PlanProposal {
  const byMarker = new Map(progress.changes.map((c) => [c.markerId, c]));
  const covered = new Set<string>();

  const items: PlanVersionItem[] = base.map((it) => {
    const tested = it.markers.map((m) => byMarker.get(m)).filter(Boolean) as MarkerChange[];
    it.markers.forEach((m) => covered.add(m));
    if (tested.length === 0) return { ...it, status: 'not_retested', note: t('Not in this test — unchanged.') };
    const note = tested.map(fmt).join(' · ');
    const allRetested = tested.length === it.markers.length;
    if (tested.every((c) => c.afterStatus === 'in')) {
      return allRetested
        ? { ...it, status: 'reached', note: `${note}. ${t('Goal reached — keep it as a habit.')}` }
        : { ...it, status: 'on_track', note: `${note}. ${t("In range; the rest of its markers weren't in this test.")}` };
    }
    if (tested.some((c) => c.verdict === 'worsening' || c.verdict === 'newly_out'))
      return { ...it, status: 'needs_attention', note: `${note}. ${t('Worth reviewing with a specialist.')}` };
    if (tested.some((c) => c.verdict === 'improving' || c.verdict === 'back_in_range'))
      return { ...it, status: 'on_track', note: `${note}. ${t('Moving the right way — keep going.')}` };
    return { ...it, status: 'needs_attention', note: `${note}. ${t('No real change yet.')}` };
  });

  // Marcadores fuera de rango que ninguna acción trabaja → acciones nuevas (una por regla). También los
  // que se miden por primera vez (sin valor anterior con el que comparar), como en una primera analítica.
  const uncovered = [
    ...progress.changes.filter((c) => c.afterStatus !== 'in').map((c) => ({ markerId: c.markerId, name: c.name, text: fmt(c) })),
    ...progress.firstTime
      .filter((f) => f.status !== 'in')
      .map((f) => ({ markerId: f.markerId, name: f.name, text: `${f.name} ${num(f.value)} ${f.unit}`.trim() })),
  ].filter((c) => !covered.has(c.markerId));
  const added = new Map<string, PlanVersionItem>();
  for (const c of uncovered) {
    const rule = RULES.find((r) => r.markers.includes(c.markerId));
    const key = rule?.title ?? `${DOCTOR_RULE.title}:${c.markerId}`;
    const existing = added.get(key);
    if (existing) {
      existing.markers.push(c.markerId);
      existing.note = `${existing.note} · ${c.text}`;
      if (rule) existing.why = ruleText(rule, existing.markers).why;
      continue;
    }
    added.set(key, {
      title: rule ? t(rule.title) : `${t(DOCTOR_RULE.title)}: ${c.name}`,
      why: rule ? ruleText(rule, [c.markerId]).why : t(DOCTOR_RULE.why),
      markers: [c.markerId],
      status: 'new',
      note: t('New from this test: {what}', { what: c.text }),
    });
  }

  const all = [...items, ...added.values()];
  const counts = { reached: 0, on_track: 0, needs_attention: 0, not_retested: 0, new: 0 };
  all.forEach((i) => counts[i.status]++);
  return { items: all, counts };
}

export const STATUS_LABEL: Record<PlanVersionItem['status'], string> = {
  reached: t('Goal reached'),
  on_track: t('On track'),
  needs_attention: t('Needs attention'),
  not_retested: t('Not retested'),
  new: t('New'),
};

// Borrador de plan para el especialista a partir de los valores fuera de rango
// (una acción por familia de marcadores). El especialista lo edita antes de enviarlo.
export function draftActionsForMarkers(markers: { id: string; name: string; value: number | string; unit: string }[]): PlanVersionItem[] {
  const out = new Map<string, PlanVersionItem>();
  for (const m of markers) {
    const rule = RULES.find((r) => r.markers.includes(m.id));
    const key = rule?.title ?? `${DOCTOR_RULE.title}: ${m.name}`;
    const line = `${m.name} ${num(m.value)} ${m.unit}`.trim();
    const existing = out.get(key);
    if (existing) {
      existing.markers.push(m.id);
      existing.note = `${existing.note} · ${line}`;
      if (rule) existing.why = ruleText(rule, existing.markers).why;
      continue;
    }
    out.set(key, {
      title: rule ? t(rule.title) : t('Follow up: {what}', { what: m.name }),
      why: rule ? ruleText(rule, [m.id]).why : t(DOCTOR_RULE.why),
      markers: [m.id],
      status: 'new',
      note: line,
    });
  }
  return [...out.values()];
}
