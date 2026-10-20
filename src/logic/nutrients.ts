import { t } from '@/i18n';

// "Your nutrients": lo que conviene recordar hoy al comer, según tus últimos resultados y tu plan.
// Cada punto se marca como hecho cada día. Orientación general de alimentación (no sustituye a un
// dietista); los textos siguen las guías habituales (OMS, EFSA, guías de lípidos y de diabetes).
// Pendiente de revisión por el asesor médico/dietista.

export interface NutrientFocus {
  id: string;
  icon: string; // MaterialCommunityIcons, salvo 'iron' (el "Fe" propio)
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

export interface FocusOptions {
  snacks?: boolean; // false = su menú no lleva tentempiés: no se habla de "tentempié"
}

const MAX_ITEMS = 5; // pocos y sencillos: es una lista para marcar cada día

export function nutrientFocus(markers: FlaggedMarker[], planTips: string[] = [], opts: FocusOptions = {}): NutrientFocus[] {
  const has = (ids: string[], test: (f: string) => boolean) => markers.some((m) => ids.includes(m.marker_id) && test(m.flag));
  // Creatinina o filtrado fuera de rango: aquí no se empuja la proteína (el menú la deja moderada)
  const kidneyFlag = has(['creatinine', 'cystatin_c'], high) || has(['egfr'], low);
  const out: NutrientFocus[] = [];

  if (has(['ferritin', 'iron', 'transferrin_saturation', 'hemoglobin'], low))
    out.push({
      id: 'iron',
      icon: 'iron', // "Fe" (propio): una gota se confunde con la sangre
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

  // Siempre, y lo primero: fruta y verdura (la OMS recomienda al menos 400 g al día) y una ración de proteína
  out.unshift({
    id: 'five_a_day',
    icon: 'carrot',
    title: t('Fruit and vegetables'),
    why: t('At least five portions a day (about 400 g) for everyone.'),
    foods: opts.snacks === false ? t('Half of lunch and dinner on the plate, and fruit for dessert.') : t('Half of lunch and dinner on the plate, and fruit as a snack.'),
  });
  if (!kidneyFlag)
    out.splice(1, 0, {
      id: 'protein',
      icon: 'egg-outline',
      title: t('A portion of protein at each meal'),
      why: t('It keeps you full for longer and looks after your muscles.'),
      foods: t('Legumes, eggs, fish, meat or dairy: about the size of your palm.'),
    });

  // Los consejos del plan que no estén ya cubiertos (sin repetir verdura ni proteína, y sin tentempiés si su
  // menú no los lleva)
  for (const [i, tip] of planTips.entries()) {
    if (out.length >= MAX_ITEMS) break;
    if (/vegetables|verdura/i.test(tip)) continue;
    if (/protein|proteína/i.test(tip)) continue;
    if (opts.snacks === false && /snack|tentempié/i.test(tip)) continue;
    out.push({ id: `plan_${i}`, icon: 'clipboard-check-outline', title: t(tip), why: t('From your plan.'), foods: '' });
  }
  return out.slice(0, MAX_ITEMS);
}
