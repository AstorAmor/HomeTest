import { t, tn } from '@/i18n';
import { historySummary, type WorkoutExport } from '@/logic/workoutExport';
import { WORDMARK } from './planPdf';

// Plan e historial de entrenamiento en PDF, con la marca (mismo estilo que el menú semanal, utils/menuPdf.ts). En el
// móvil se comparte como fichero (utils/shareHtml.ts); en la web se abre el diálogo de imprimir / guardar como PDF.
// Los datos salen de logic/workoutExport.ts, igual que el texto para una IA.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function planHtml(p: NonNullable<WorkoutExport['plan']>): string {
  const routines = p.routines
    .map((r) => {
      const rows = r.blocks
        .map(
          (b) =>
            `<tr class="block"><td colspan="3">${esc(b.label)}</td></tr>` +
            b.items
              .map(
                (it) =>
                  `<tr><td class="ex">${esc(it.name)}${it.note ? `<em>${esc(it.note)}</em>` : ''}</td><td>${esc(it.dose)}${it.perSet ? `<small>${esc(it.perSet)}</small>` : ''}</td><td class="rest">${esc(it.rest)}</td></tr>`,
              )
              .join(''),
        )
        .join('');
      return `<section class="routine"><h3>${esc(r.title)}<span>${esc([r.days, `~${r.minutes} min`].filter(Boolean).join(' · '))}</span></h3>${
        rows ? `<table>${rows}</table>` : `<p class="muted">${esc(t('No exercises yet.'))}</p>`
      }</section>`;
    })
    .join('\n');
  return `<h2>${esc(t('Plan: {name}', { name: p.title }))}</h2>
<p class="byline">${esc(p.byline.join(' · '))}</p>
${p.note ? `<div class="note">${esc(t('Note from the trainer: «{note}»', { note: p.note }))}</div>` : ''}
${routines}`;
}

function historyHtml(h: NonNullable<WorkoutExport['history']>, breakBefore: boolean): string {
  const head = `<h2${breakBefore ? ' class="new-page"' : ''}>${esc(t('History: {period}', { period: h.period }))}</h2>`;
  if (!h.count) return `${head}<p class="muted">${esc(t('No workouts in this period.'))}</p>`;
  const progress = h.progress.length
    ? `<h2>${esc(t('Progress by exercise'))}</h2>
<p class="muted">${esc(t('Heaviest set the first and the last time in this period, and the best one.'))}</p>
<table class="progress"><thead><tr><th>${esc(t('Exercise'))}</th><th>${esc(t('Sessions'))}</th><th>${esc(t('First time'))}</th><th>${esc(t('Last time'))}</th><th>${esc(t('Best'))}</th></tr></thead><tbody>${h.progress
        .map((r) => `<tr><td class="ex">${esc(r.name)}</td><td class="num">${r.sessions}</td><td>${esc(r.first)}</td><td>${esc(r.last)}</td><td>${esc(r.best)}</td></tr>`)
        .join('')}</tbody></table>`
    : '';
  const months = h.months
    .map(
      (m) =>
        `<tr class="block"><td colspan="3">${esc(m.month)}</td></tr>` +
        m.items
          .map(
            (e) =>
              `<tr><td class="when">${esc(e.when)}</td><td><b>${esc(e.title)}</b>${e.program ? ` <span class="muted">(${esc(e.program)})</span>` : ''}<small>${esc(
                [`${e.minutes} min`, ...e.facts].join(' · '),
              )}</small></td><td>${e.exercises.map((x) => `<div class="set"><span>${esc(x.name)}</span><b>${esc(x.sets)}</b></div>`).join('')}</td></tr>`,
          )
          .join(''),
    )
    .join('');
  return `${head}
<p class="byline">${esc(historySummary(h))}</p>
${progress}
<h2>${esc(t('Session by session'))}</h2>
<table class="history">${months}</table>`;
}

export function workoutsToHtml(doc: WorkoutExport, title: string): string {
  const meta = [
    doc.plan ? [t('Programme'), doc.plan.title] : null,
    doc.history ? [t('History'), tn(doc.history.count, '{n} workout', '{n} workouts')] : null,
    doc.history && doc.history.count ? [t('Per week'), doc.history.perWeek] : null,
  ].filter((x): x is string[] => !!x);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  @media screen { body { max-width: 860px; margin: 0 auto !important; padding: 24px; } }
  body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #2A2A2A; font-size: 11.5px; line-height: 1.45; background: #fff; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0E2A24; padding-bottom: 10px; margin-bottom: 14px; }
  .brand small { display: block; letter-spacing: 4px; font-size: 8px; color: #8A6D3F; margin-top: 3px; }
  .doc-title { text-align: right; }
  .doc-title h1 { margin: 0; font-size: 20px; color: #0E2A24; }
  .doc-title span { color: #5E6B66; font-size: 11px; }
  .meta { display: flex; gap: 24px; background: #FAF8F3; border: 1px solid #EDE5D9; border-radius: 8px; padding: 9px 14px; margin-bottom: 14px; }
  .meta div { font-size: 10.5px; color: #5E6B66; }
  .meta strong { display: block; color: #2A2A2A; font-size: 12.5px; }
  h2 { font-size: 15px; color: #0E2A24; margin: 16px 0 4px; break-after: avoid; page-break-after: avoid; }
  h2.new-page { break-before: page; page-break-before: always; margin-top: 0; }
  .byline { color: #5E6B66; margin: 0 0 8px; }
  .muted { color: #748A82; }
  .note { border: 1px solid #EDE5D9; border-left: 3px solid #C9A36B; border-radius: 8px; padding: 8px 12px; margin: 6px 0 10px; font-style: italic; }
  .routine { break-inside: avoid; page-break-inside: avoid; margin-bottom: 12px; }
  .routine h3 { font-size: 12.5px; color: #0E2A24; margin: 10px 0 4px; display: flex; justify-content: space-between; gap: 12px; }
  .routine h3 span { font-weight: 400; color: #5E6B66; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  thead th { background: #0E2A24; color: #fff; font-size: 10.5px; text-align: left; padding: 5px 7px; }
  td { padding: 5px 7px; vertical-align: top; border-bottom: 1px solid #EDE5D9; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  tr.block td { background: #FAF8F3; color: #8A6D3F; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 7px; }
  td.ex { font-weight: 600; width: 38%; }
  td em, td small { display: block; color: #748A82; font-style: normal; font-size: 9.5px; font-weight: 400; }
  td.rest { color: #5E6B66; white-space: nowrap; width: 18%; }
  td.num { text-align: center; }
  td.when { white-space: nowrap; width: 17%; color: #0E2A24; font-weight: 600; }
  .history td:nth-child(2) { width: 30%; }
  .set { display: flex; justify-content: space-between; gap: 10px; }
  .set b { font-weight: 400; color: #5E6B66; text-align: right; }
  .progress td.ex { width: 28%; }
  footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #EDE5D9; font-size: 9.5px; color: #748A82; }
</style>
</head>
<body>
<header>
  <div class="brand">${WORDMARK}<small>HEALTH</small></div>
  <div class="doc-title"><h1>${esc(t('Workouts'))}</h1><span>${esc(t('Exported on {date}.', { date: doc.exportedAt }))}</span></div>
</header>
${meta.length ? `<div class="meta">${meta.map(([k, v]) => `<div>${esc(k)}<strong>${esc(v)}</strong></div>`).join('')}</div>` : ''}
${doc.plan ? planHtml(doc.plan) : ''}
${doc.history ? historyHtml(doc.history, !!doc.plan) : ''}
<footer>
  ${esc(t('Weights in kg; «8–10» are reps; «30 s» and «0:30» are time; «+kg» is weight added to your body weight.'))}
  ${esc(t('Exported from Kuova Health · kuovahealth.com'))}
</footer>
</body>
</html>`;
}
