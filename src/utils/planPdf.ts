import { dateLocale } from '@/i18n';
import { currentReport, findMarkerInCurrentReport } from '@/data/reportRepository';
import {
  getActionPlanContentEn,
  getMarkerDisplayNameEn,
  getUnitLabelEn,
} from '@/data/reportContentEn';
import { axisPadding, getResponseProfile, HORIZON_MONTHS, projectionCurve } from '@/logic/projection';

// Plan personalizado como documento para imprimir o enviar (PDF por WhatsApp, correo,
// al médico…). Aquí solo se arma el contenido (HTML y texto plano); generar el PDF y
// compartirlo depende de la plataforma (utils/sharePlan.ts y sharePlan.web.ts).

export interface PlanDocAction {
  title: string;
  confidence: string;
  why: string[];
  how: string[];
  caveats: string[];
  projection: {
    markerId: string;
    markerName: string;
    unit: string;
    current: number;
    expected: number;
    low: number;
    high: number;
    note?: string;
  };
}

export interface PlanDoc {
  patientName: string;
  testDate: string; // YYYY-MM-DD
  generatedAt: Date;
  actions: PlanDocAction[];
}

const CONFIDENCE_EN: Record<string, string> = { alta: 'High', media: 'Medium', baja: 'Low' };

export function buildPlanDoc(patientName: string, generatedAt = new Date()): PlanDoc {
  const actions = [...currentReport.action_plan]
    .sort((a, b) => Number(b.pinned) - Number(a.pinned))
    .map((item): PlanDocAction => {
      const content = getActionPlanContentEn(item.action_id, {
        title: item.title,
        why: item.why,
        how: item.how,
        caveats: item.caveats,
      });
      const est = item.estimated_next_test;
      const marker = findMarkerInCurrentReport(est.marker_id);
      const unit = getUnitLabelEn(marker?.unit ?? null);
      return {
        ...content,
        confidence: CONFIDENCE_EN[item.confidence] ?? item.confidence,
        projection: {
          markerId: est.marker_id,
          markerName: getMarkerDisplayNameEn(est.marker_id, est.marker_id.replace(/_/g, ' ')),
          unit: unit === 'index' ? '' : unit, // HOMA-IR y similares no tienen unidad
          current: est.current_value,
          expected: est.expected_value_in_6_months,
          low: est.expected_range_low,
          high: est.expected_range_high,
          note: getResponseProfile(est.marker_id).note,
        },
      };
    });
  return { patientName, testDate: currentReport.test_date, generatedAt, actions };
}

const longDate = (d: Date) => d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
const isoToDate = (iso: string) => new Date(`${iso}T12:00:00`);

export const planFileName = (doc: PlanDoc) => `Kuova-plan-${doc.generatedAt.toISOString().slice(0, 10)}`;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const withUnit = (value: number, unit: string) => (unit ? `${value} ${unit}` : `${value}`);

// Misma curva que ProjectionChart, pero como SVG en texto para el HTML del PDF.
function projectionSvg(p: PlanDocAction['projection']): string {
  // Ancho ≈ el de la tarjeta en un A4, para que el texto del SVG salga a tamaño real
  const W = 640;
  const H = 110;
  const PAD_X = 6;
  const PAD_Y = 12;
  const curve = projectionCurve({
    markerId: p.markerId,
    currentValue: p.current,
    expectedValue: p.expected,
    rangeLow: p.low,
    rangeHigh: p.high,
  });
  const values = [p.current, p.expected, p.low, p.high];
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = axisPadding(rawMin, rawMax);
  const min = rawMin - pad;
  const max = rawMax + pad;
  const x = (m: number) => PAD_X + (m / HORIZON_MONTHS) * (W - PAD_X * 2);
  const y = (v: number) => H - PAD_Y - ((v - min) / (max - min || 1)) * (H - PAD_Y * 2);
  const xy = (m: number, v: number) => `${x(m).toFixed(1)},${y(v).toFixed(1)}`;
  const band = [...curve.map((c) => xy(c.month, c.high)), ...[...curve].reverse().map((c) => xy(c.month, c.low))].join(' ');
  const line = curve.map((c, i) => `${i ? 'L' : 'M'}${xy(c.month, c.expected)}`).join(' ');
  const last = curve[curve.length - 1];
  return `<svg viewBox="0 0 ${W} ${H + 18}" class="chart" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Projection for ${esc(p.markerName)}">
  <line x1="${x(3)}" x2="${x(3)}" y1="4" y2="${H - 4}" stroke="#D9D2C5" stroke-dasharray="3,4"/>
  <polygon points="${band}" fill="#C9A36B" fill-opacity="0.22"/>
  <path d="${line}" fill="none" stroke="#0E2A24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${x(0)}" cy="${y(p.current)}" r="3.5" fill="#748A82"/>
  <circle cx="${x(last.month)}" cy="${y(last.expected)}" r="4.5" fill="#0E2A24"/>
  <text x="${x(0)}" y="${H + 14}" font-size="10" fill="#5E6B66">Now · ${esc(withUnit(p.current, p.unit))}</text>
  <text x="${x(3)}" y="${H + 14}" font-size="10" fill="#5E6B66" text-anchor="middle">3 months</text>
  <text x="${x(HORIZON_MONTHS)}" y="${H + 14}" font-size="10" fill="#5E6B66" text-anchor="end">6 months · ~${esc(withUnit(p.expected, p.unit))}</text>
</svg>`;
}

// Logotipo KUOVA (mismos trazos que components/KuovaLogo.tsx)
const WORDMARK = `<svg viewBox="226 189 1556 276" height="22" xmlns="http://www.w3.org/2000/svg" aria-label="Kuova">
  <path d="M230 200H268V327L427 200H490L333.67 315.49L480 457H424L302.58 338.45L268 364V402C267 430 250 450 230 457Z" fill="#0E2A24"/>
  <path d="M561.5 198v141a103.5 103.5 0 0 0 207 0V198" fill="none" stroke="#0E2A24" stroke-width="37"/>
  <ellipse cx="990.5" cy="326.5" rx="126.5" ry="116.5" fill="none" stroke="#0E2A24" stroke-width="38"/>
  <path d="M1167 196h41l109 214 116-214h42l-142 260h-32Z" fill="#0E2A24"/>
  <path d="M1593 196h39l146 261h-43l-123-214-128 214h-43Z" fill="#0E2A24"/>
</svg>`;

export function planToHtml(doc: PlanDoc): string {
  const actions = doc.actions
    .map((a, i) => {
      const p = a.projection;
      return `<section class="action">
  <div class="action-head">
    <h2><span class="num">${i + 1}</span>${esc(a.title)}</h2>
    <span class="badge">${esc(a.confidence)} confidence</span>
  </div>
  ${a.why.map((w) => `<p class="why">${esc(w)}</p>`).join('\n  ')}
  ${a.how.length ? `<ul class="how">${a.how.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
  ${a.caveats.map((c) => `<p class="caveat">⚠ ${esc(c)}</p>`).join('\n  ')}
  <div class="projection">
    <div class="projection-head">
      <strong>${esc(p.markerName)}</strong>
      <span>${esc(withUnit(p.current, p.unit))} → ~${esc(withUnit(p.expected, p.unit))} in 6 months
        <em>(expected ${p.low}–${p.high}${p.unit ? ` ${esc(p.unit)}` : ''})</em></span>
    </div>
    ${projectionSvg(p)}
    ${p.note ? `<p class="note">${esc(p.note)}</p>` : ''}
  </div>
</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(planFileName(doc))}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  @media screen { body { max-width: 820px; margin: 0 auto !important; padding: 24px; } }
  body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #2A2A2A; font-size: 12.5px; line-height: 1.5; background: #fff; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0E2A24; padding-bottom: 10px; margin-bottom: 16px; }
  .brand small { display: block; letter-spacing: 4px; font-size: 8px; color: #8A6D3F; margin-top: 3px; }
  .doc-title { text-align: right; }
  .doc-title h1 { margin: 0; font-size: 20px; color: #0E2A24; }
  .doc-title span { color: #5E6B66; font-size: 11px; }
  .meta { display: flex; gap: 24px; background: #FAF8F3; border: 1px solid #EDE5D9; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; }
  .meta div { font-size: 11px; color: #5E6B66; }
  .meta strong { display: block; color: #2A2A2A; font-size: 13px; }
  .intro { color: #444; margin: 0 0 16px; }
  .action { border: 1px solid #EDE5D9; border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; page-break-inside: avoid; break-inside: avoid; }
  .action-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  h2 { font-size: 15px; margin: 0 0 6px; color: #0E2A24; }
  .num { display: inline-block; width: 20px; height: 20px; border-radius: 10px; background: #0E2A24; color: #fff; font-size: 11px; text-align: center; line-height: 20px; margin-right: 8px; }
  .badge { font-size: 10px; font-weight: 700; color: #8A6D3F; background: #F4ECDF; padding: 3px 8px; border-radius: 6px; white-space: nowrap; }
  .why { margin: 4px 0; color: #444; }
  .how { margin: 6px 0; padding-left: 18px; }
  .how li { margin: 2px 0; }
  .caveat { margin: 6px 0 0; color: #9A5B00; font-size: 11.5px; }
  .projection { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #EDE5D9; }
  .projection-head { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px; font-size: 12px; margin-bottom: 4px; }
  .projection-head em { color: #748A82; font-style: normal; font-size: 11px; }
  .chart { display: block; width: 100%; height: auto; }
  .note { margin: 4px 0 0; font-size: 11px; color: #5E6B66; }
  footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #EDE5D9; font-size: 10px; color: #748A82; }
</style>
</head>
<body>
<header>
  <div class="brand">${WORDMARK}<small>HEALTH</small></div>
  <div class="doc-title"><h1>Personalised plan</h1><span>What you can do and what we expect to improve</span></div>
</header>
<div class="meta">
  <div>Name<strong>${esc(doc.patientName)}</strong></div>
  <div>Based on the blood test of<strong>${esc(longDate(isoToDate(doc.testDate)))}</strong></div>
  <div>Generated<strong>${esc(longDate(doc.generatedAt))}</strong></div>
</div>
<p class="intro">Each action explains why it matters for you, how to do it, and where the related marker could be at your next test in about ${HORIZON_MONTHS} months. The shaded band is the expected range: it widens over time because it is an estimate, not a promise.</p>
${actions}
<footer>
  These are estimates based on your results and habits, not a diagnosis. Talk to your doctor before starting supplements or changing any medication.
  Generated with Kuova Health · kuovahealth.com
</footer>
</body>
</html>`;
}

// Versión en texto (para compartir sin PDF cuando el móvil no tiene el módulo de impresión).
export function planToText(doc: PlanDoc): string {
  const lines = [
    `Personalised plan · ${doc.patientName}`,
    `Based on the blood test of ${longDate(isoToDate(doc.testDate))}`,
    '',
  ];
  doc.actions.forEach((a, i) => {
    const p = a.projection;
    lines.push(`${i + 1}. ${a.title}`);
    a.how.forEach((h) => lines.push(`   • ${h}`));
    a.caveats.forEach((c) => lines.push(`   ⚠ ${c}`));
    lines.push(`   ${p.markerName}: ${withUnit(p.current, p.unit)} → ~${withUnit(p.expected, p.unit)} in 6 months`);
    lines.push('');
  });
  lines.push('Estimates, not a diagnosis. Generated with Kuova Health.');
  return lines.join('\n');
}
