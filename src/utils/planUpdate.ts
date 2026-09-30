import { currentReport } from '@/data/reportRepository';
import { getActionPlanContentEn } from '@/data/reportContentEn';
import { PlanVersion, PlanVersionItem } from '@/data/planVersions';
import { MarkerChange, ProgressResult } from './progress';

// Propone un plan actualizado a partir de lo que ha cambiado en una analítica nueva.
// - Acción cuyos marcadores no se han vuelto a medir → se queda igual ("not retested").
// - Todos sus marcadores medidos ya en rango → objetivo conseguido: se mantiene como hábito.
// - Mejorando → "on track"; sin cambio o peor → "needs attention" (y se sugiere hablar
//   con un profesional).
// - Marcador que ahora está fuera de rango y ninguna acción lo trabaja → acción nueva
//   de la biblioteca de abajo (texto general, revisable por un médico de HomeTest).
// Es una propuesta: el usuario la aplica y queda como versión nueva del plan.

type BaseItem = Omit<PlanVersionItem, 'status' | 'note'>;

// Plan vigente: la última versión guardada o, si no hay, el action plan del informe.
export function basePlanItems(latest: PlanVersion | null): BaseItem[] {
  if (latest) return latest.items.map(({ title, why, markers }) => ({ title, why, markers }));
  return currentReport.action_plan.map((a) => {
    const en = getActionPlanContentEn(a.action_id, { title: a.title, why: a.why, how: a.how, caveats: a.caveats });
    const markers = Array.from(new Set([...(a.linked_markers ?? []), a.estimated_next_test?.marker_id].filter(Boolean) as string[]));
    return { title: en.title, why: en.why.join(' '), markers };
  });
}

const fmt = (c: MarkerChange) => `${c.name} ${c.before} → ${c.after} ${c.unit}`.trim();

interface Rule {
  markers: string[];
  title: string;
  why: string;
}

const RULES: Rule[] = [
  { markers: ['glucose', 'hba1c', 'insulin', 'homa_ir', 'fructosamine'], title: 'Keep your blood sugar steady', why: 'A 10-minute walk after meals, vegetables and protein first, and fewer refined carbs and sugary drinks.' },
  { markers: ['ldl', 'apob', 'total_cholesterol', 'non_hdl_cholesterol', 'triglycerides', 'hdl', 'lpa'], title: 'Support your cholesterol', why: 'Olive oil, nuts, oily fish and fibre; less processed meat and pastries. Regular movement raises HDL.' },
  { markers: ['ferritin', 'iron', 'transferrin_saturation', 'hemoglobin', 'tibc'], title: 'Look after your iron', why: 'Iron-rich foods (red meat, legumes, spinach) with vitamin C. Talk to a doctor before taking supplements.' },
  { markers: ['vitamin_d'], title: 'Raise your vitamin D', why: '15 minutes of midday sun most days and oily fish. Ask a doctor whether you need a supplement.' },
  { markers: ['vitamin_b12', 'folate'], title: 'Top up your B vitamins', why: 'Eggs, fish, dairy and leafy greens. A doctor can tell you if you need a supplement.' },
  { markers: ['alt', 'ast', 'ggt'], title: 'Give your liver a break', why: 'Cut back on alcohol and sugary drinks, and keep a healthy weight.' },
  { markers: ['hs_crp', 'esr', 'fibrinogen'], title: 'Lower inflammation', why: 'Regular sleep, daily movement and oily fish help bring inflammation markers down.' },
  { markers: ['uric_acid', 'creatinine', 'egfr', 'cystatin_c'], title: 'Support your kidneys', why: 'Drink enough water and limit alcohol, sugary drinks and very salty food.' },
];

const DOCTOR_RULE: Omit<Rule, 'markers'> = {
  title: 'Review this result with a doctor',
  why: 'This marker is out of range and needs a professional look before changing anything.',
};

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
    if (tested.length === 0) return { ...it, status: 'not_retested', note: 'Not in this test — unchanged.' };
    const note = tested.map(fmt).join(' · ');
    const allRetested = tested.length === it.markers.length;
    if (tested.every((c) => c.afterStatus === 'in')) {
      return allRetested
        ? { ...it, status: 'reached', note: `${note}. Goal reached — keep it as a habit.` }
        : { ...it, status: 'on_track', note: `${note}. In range; the rest of its markers weren't in this test.` };
    }
    if (tested.some((c) => c.verdict === 'worsening' || c.verdict === 'newly_out'))
      return { ...it, status: 'needs_attention', note: `${note}. Worth reviewing with a specialist.` };
    if (tested.some((c) => c.verdict === 'improving' || c.verdict === 'back_in_range'))
      return { ...it, status: 'on_track', note: `${note}. Moving the right way — keep going.` };
    return { ...it, status: 'needs_attention', note: `${note}. No real change yet.` };
  });

  // Marcadores fuera de rango que ninguna acción trabaja → acciones nuevas (una por regla)
  const uncovered = progress.changes.filter((c) => c.afterStatus !== 'in' && !covered.has(c.markerId));
  const added = new Map<string, PlanVersionItem>();
  for (const c of uncovered) {
    const rule = RULES.find((r) => r.markers.includes(c.markerId));
    const key = rule?.title ?? `${DOCTOR_RULE.title}:${c.markerId}`;
    const existing = added.get(key);
    if (existing) {
      existing.markers.push(c.markerId);
      existing.note = `${existing.note} · ${fmt(c)}`;
      continue;
    }
    added.set(key, {
      title: rule?.title ?? `${DOCTOR_RULE.title}: ${c.name}`,
      why: rule?.why ?? DOCTOR_RULE.why,
      markers: [c.markerId],
      status: 'new',
      note: `New from this test: ${fmt(c)}`,
    });
  }

  const all = [...items, ...added.values()];
  const counts = { reached: 0, on_track: 0, needs_attention: 0, not_retested: 0, new: 0 };
  all.forEach((i) => counts[i.status]++);
  return { items: all, counts };
}

export const STATUS_LABEL: Record<PlanVersionItem['status'], string> = {
  reached: 'Goal reached',
  on_track: 'On track',
  needs_attention: 'Needs attention',
  not_retested: 'Not retested',
  new: 'New',
};

// Borrador de plan para el especialista a partir de los valores fuera de rango
// (una acción por familia de marcadores). El especialista lo edita antes de enviarlo.
export function draftActionsForMarkers(markers: { id: string; name: string; value: number | string; unit: string }[]): PlanVersionItem[] {
  const out = new Map<string, PlanVersionItem>();
  for (const m of markers) {
    const rule = RULES.find((r) => r.markers.includes(m.id));
    const key = rule?.title ?? `${DOCTOR_RULE.title}: ${m.name}`;
    const line = `${m.name} ${m.value} ${m.unit}`.trim();
    const existing = out.get(key);
    if (existing) {
      existing.markers.push(m.id);
      existing.note = `${existing.note} · ${line}`;
      continue;
    }
    out.set(key, {
      title: rule?.title ?? `Follow up: ${m.name}`,
      why: rule?.why ?? DOCTOR_RULE.why,
      markers: [m.id],
      status: 'new',
      note: line,
    });
  }
  return [...out.values()];
}
