import { amountText, FOODS, foodName, getRecipe, recipeName, SECTION_LABEL, slotLabel } from '@/data/diet/catalog';
import type { DietPlan, ShopSection } from '@/data/diet/types';
import { dayTotals, shoppingList, weekSummary } from '@/logic/dietPlanner';
import { num, t } from '@/i18n';
import { WORDMARK } from './planPdf';

// Menú semanal y lista de la compra en PDF, con la marca (mismo estilo que el PDF del plan). En el móvil se
// comparte como fichero (utils/shareHtml.ts); en la web se abre el diálogo de imprimir / guardar como PDF.

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ORDER: ShopSection[] = ['produce', 'meat_fish', 'chilled', 'frozen', 'bakery', 'pantry'];
const STAPLES = new Set(['salt', 'paprika', 'cumin', 'oregano', 'cinnamon']);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const menuFileName = (now = new Date()) => `Kuova-menu-${localDay(now)}`;

function shopSections(plan: DietPlan, skip: string[] = []) {
  const items = shoppingList(plan.days);
  return ORDER.map((sec) => ({
    sec,
    items: items
      .filter((i) => FOODS[i.food]?.section === sec && !skip.includes(i.food))
      .map((i) => ({ name: foodName(FOODS[i.food]), amount: STAPLES.has(i.food) ? t('to taste') : amountText(i.food, i.grams, { whole: true }) })),
  })).filter((s) => s.items.length);
}

// Para compartir como texto (WhatsApp, notas…): con cabecera de la marca
export function shoppingText(plan: DietPlan, skip: string[] = []): string {
  const body = shopSections(plan, skip)
    .map((s) => `${t(SECTION_LABEL[s.sec])}\n${s.items.map((i) => `- ${i.name}: ${i.amount}`).join('\n')}`)
    .join('\n\n');
  return `${t('Shopping list · KUOVA')}\n${t('For your weekly menu')}\n\n${body}\n\n${t('Made with Kuova Health · kuovahealth.com')}`;
}

export function menuToHtml(plan: DietPlan, now = new Date()): string {
  const slots = plan.days[0]?.meals.map((m) => m.slot) ?? [];
  const summary = weekSummary(plan.days);
  const cautions = plan.reasons.filter((r) => r.caution);
  const potassium = Math.round(plan.days.reduce((a, d) => a + dayTotals(d).potassium, 0) / Math.max(1, plan.days.length) / 100) * 100;
  const vars = { kcal: num(plan.targets.kcal), protein: Math.round(summary.protein), potassium };
  const total = shoppingList(plan.days).reduce((a, i) => a + i.cost, 0);

  const rows = plan.days
    .map((d) => {
      const cells = d.meals
        .map((m) => {
          const r = getRecipe(m.recipeId);
          return `<td>${r ? esc(recipeName(r)) : ''}${m.leftover ? `<em>${esc(t('leftovers from yesterday'))}</em>` : ''}</td>`;
        })
        .join('');
      return `<tr><th>${esc(t(DAYS[d.day]))}<small>${Math.round(dayTotals(d).kcal)} kcal</small></th>${cells}</tr>`;
    })
    .join('\n');

  const shop = shopSections(plan)
    .map(
      (s) => `<div class="shop-sec"><h3>${esc(t(SECTION_LABEL[s.sec]))}</h3><ul>${s.items
        .map((i) => `<li><span class="box"></span>${esc(i.name)}<b>${esc(i.amount)}</b></li>`)
        .join('')}</ul></div>`
    )
    .join('\n');

  const caution = cautions.length
    ? `<div class="caution"><strong>${esc(t('To discuss with your doctor'))}</strong>${cautions
        .map((c) => `<p><b>${esc(t(c.title))}.</b> ${esc(t(c.detail, vars))}</p>`)
        .join('')}</div>`
    : '';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(menuFileName(now))}</title>
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
  .meta { display: flex; gap: 24px; background: #FAF8F3; border: 1px solid #EDE5D9; border-radius: 8px; padding: 9px 14px; margin-bottom: 12px; }
  .meta div { font-size: 10.5px; color: #5E6B66; }
  .meta strong { display: block; color: #2A2A2A; font-size: 12.5px; }
  .caution { border: 1px solid #EDE5D9; border-left: 3px solid #C9A36B; border-radius: 8px; padding: 9px 12px; margin-bottom: 12px; }
  .caution strong { color: #0E2A24; font-size: 12.5px; }
  .caution p { margin: 4px 0 0; color: #444; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 16px; }
  thead th { background: #0E2A24; color: #fff; font-size: 10.5px; text-align: left; padding: 6px 7px; }
  tbody th { width: 13%; text-align: left; color: #0E2A24; font-size: 11px; padding: 6px 7px; vertical-align: top; }
  tbody th small { display: block; color: #748A82; font-weight: 400; font-size: 9.5px; }
  td { padding: 6px 7px; vertical-align: top; border-bottom: 1px solid #EDE5D9; }
  td em { display: block; color: #748A82; font-style: normal; font-size: 9.5px; }
  tbody tr:nth-child(even) { background: #FAF8F3; }
  h2 { font-size: 15px; color: #0E2A24; margin: 6px 0 8px; break-after: avoid; }
  .shop { columns: 2; column-gap: 24px; }
  .shop-sec { break-inside: avoid; page-break-inside: avoid; margin-bottom: 10px; }
  .shop-sec h3 { font-size: 11.5px; color: #8A6D3F; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px; }
  .shop-sec ul { list-style: none; margin: 0; padding: 0; }
  .shop-sec li { display: flex; align-items: center; gap: 7px; padding: 2px 0; }
  .shop-sec li b { margin-left: auto; font-weight: 400; color: #5E6B66; white-space: nowrap; }
  .box { width: 10px; height: 10px; border: 1.2px solid #0E2A24; border-radius: 2px; flex: none; }
  .shop-page { break-before: page; page-break-before: always; }
  footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #EDE5D9; font-size: 9.5px; color: #748A82; }
</style>
</head>
<body>
<header>
  <div class="brand">${WORDMARK}<small>HEALTH</small></div>
  <div class="doc-title"><h1>${esc(t('Weekly menu'))}</h1><span>${esc(plan.source === 'professional' ? t('From {name}', { name: plan.professionalName || t('your dietitian') }) : t('Made for you'))}</span></div>
</header>
<div class="meta">
  <div>${esc(t('Energy'))}<strong>~${esc(num(plan.targets.kcal))} kcal / ${esc(t('day'))}</strong></div>
  <div>${esc(t('Protein'))}<strong>~${Math.round(summary.protein)} g / ${esc(t('day'))}</strong></div>
  <div>${esc(t('Shopping'))}<strong>~${esc(num(Math.round(total)))} € / ${esc(t('week'))}</strong></div>
</div>
${caution}
<table>
  <thead><tr><th></th>${slots.map((s) => `<th>${esc(slotLabel(s, plan.prefs))}</th>`).join('')}</tr></thead>
  <tbody>
${rows}
  </tbody>
</table>
<div class="shop-page">
  <h2>${esc(t('Shopping list · KUOVA'))}</h2>
  <div class="shop">
${shop}
  </div>
</div>
<footer>
  ${esc(t('General guidance based on dietary guidelines and your answers: it does not replace your doctor or a dietitian.'))}
  ${esc(t('Made with Kuova Health · kuovahealth.com'))}
</footer>
</body>
</html>`;
}
