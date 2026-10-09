import { t } from '@/i18n';

// "Your nutrients": lo que conviene recordar hoy al comer, según tus últimos resultados y tu plan.
// Cada punto se marca como hecho cada día. Orientación general de alimentación (no sustituye a un
// dietista); los textos siguen las guías habituales (OMS, EFSA, guías de lípidos y de diabetes).
// Pendiente de revisión por el asesor médico/dietista.

export interface NutrientFocus {
  id: string;
  icon: string; // MaterialCommunityIcons
  title: string;
  why: string;
  foods: string;
}

export interface FlaggedMarker {
  marker_id: string;
  flag: string; // 'bajo' | 'limite_bajo' | 'alto' | 'limite_alto' | 'en_rango'…
}

const low = (f: string) => f === 'bajo' || f === 'limite_bajo';
const high = (f: string) => f === 'alto' || f === 'limite_alto';

export function nutrientFocus(markers: FlaggedMarker[], planTips: string[] = []): NutrientFocus[] {
  const has = (ids: string[], test: (f: string) => boolean) => markers.some((m) => ids.includes(m.marker_id) && test(m.flag));
  const out: NutrientFocus[] = [];

  if (has(['ferritin', 'iron', 'transferrin_saturation', 'hemoglobin'], low))
    out.push({
      id: 'iron',
      icon: 'water',
      title: t('More iron'),
      why: t('Your iron stores (ferritin) came out low.'),
      foods: t('Lentils, chickpeas, clams or mussels, and red meat once or twice a week. Add vitamin C (pepper, citrus) and keep coffee and tea away from meals.'),
    });
  if (has(['vitamin_d'], low))
    out.push({
      id: 'vitamin_d',
      icon: 'weather-sunny',
      title: t('Vitamin D'),
      why: t('Your vitamin D came out low.'),
      foods: t('Oily fish (salmon, sardines, mackerel) and eggs, plus a short walk outside at midday. If it stays low, ask about a supplement.'),
    });
  if (has(['vitamin_b12'], low))
    out.push({
      id: 'b12',
      icon: 'lightning-bolt-outline',
      title: t('Vitamin B12'),
      why: t('Your vitamin B12 came out low.'),
      foods: t('Eggs, dairy, fish and meat. If you eat a plant-based diet, you need a supplement.'),
    });
  if (has(['ldl', 'total_cholesterol', 'non_hdl_cholesterol', 'apob'], high))
    out.push({
      id: 'fibre_fats',
      icon: 'sprout-outline',
      title: t('Fibre and good fats'),
      why: t('Your LDL cholesterol is above the target.'),
      foods: t('Oats, legumes and a handful of nuts; olive oil instead of butter; fewer processed meats and pastries.'),
    });
  if (has(['triglycerides'], high) || has(['hs_crp'], high))
    out.push({
      id: 'omega3',
      icon: 'fish',
      title: t('Omega-3'),
      why: t('Your triglycerides or inflammation marker came out high.'),
      foods: t('Oily fish twice a week, walnuts and olive oil. Fewer sugary drinks and refined carbs.'),
    });
  if (has(['homa_ir', 'glucose', 'hba1c', 'insulin'], high))
    out.push({
      id: 'fibre_first',
      icon: 'food-apple-outline',
      title: t('Fibre first'),
      why: t('Your blood sugar control (HOMA-IR or glucose) could be better.'),
      foods: t('Start meals with vegetables or salad, choose wholegrain over white, and swap sugary drinks for water.'),
    });

  // Siempre: fruta y verdura (la OMS recomienda al menos 400 g al día)
  out.push({
    id: 'five_a_day',
    icon: 'carrot',
    title: t('Fruit and vegetables'),
    why: t('At least five portions a day (about 400 g) for everyone.'),
    foods: t('Half of lunch and dinner on the plate, and fruit as a snack.'),
  });

  // Los consejos del plan que no estén ya cubiertos
  for (const [i, tip] of planTips.entries()) {
    if (out.length >= 6) break;
    if (/vegetables|verdura/i.test(tip) && out.some((o) => o.id === 'five_a_day')) continue;
    out.push({ id: `plan_${i}`, icon: 'clipboard-check-outline', title: t(tip), why: t('From your plan.'), foods: '' });
  }
  return out;
}
