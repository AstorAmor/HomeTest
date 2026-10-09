// "Your plan" en Today y la presentación del plan tras el onboarding. Antes de la primera
// analítica se construye con lo que el usuario contó: actividad, sueño, hábitos, objetivos,
// condiciones y edad. Se eligen las 3-4 acciones que más le pueden aportar, con metas un paso por
// encima de donde está, y el "por qué" le dice qué de sus respuestas lo ha decidido. Cuando llegue
// la analítica, el motor de recomendaciones añadirá lo que digan sus marcadores.
// Reglas PENDIENTES de revisión médica. Fuentes en src/data/evidence.ts (tema "plan").
export type PlanItemKind = 'strength' | 'steps' | 'nutrition' | 'sleep' | 'mindfulness';

export interface PlanItem {
  kind: PlanItemKind;
  title: string;
  subtitle: string;
  target: number; // meta en la unidad del tipo (sesiones/semana, pasos/día, comidas/día, horas, sesiones/semana)
  why: string; // por qué está en tu plan
  how: string[]; // recomendaciones concretas
}

// Lo que usa el plan del perfil (UserProfile cumple esta forma)
export interface PlanProfile {
  goals?: string[];
  activity?: string;
  sleep?: string;
  smoking?: string;
  alcohol?: string;
  conditions?: string[];
  dateOfBirth?: string;
  sex?: string;
  heightCm?: number;
  weightKg?: number;
}

const ageOf = (dob?: string) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
};
const fmtSteps = (n: number) => n.toLocaleString('en-GB');
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

interface Candidate {
  item: PlanItem;
  score: number;
}

function steps(p: PlanProfile, age: number | null, has: (g: string) => boolean, cond: (c: string) => boolean): Candidate {
  const older = age != null && age >= 60;
  const target =
    p.activity === 'sedentary'
      ? age != null && age >= 70
        ? 5000
        : 6000
      : p.activity === 'light' || !p.activity
        ? p.activity
          ? 7500
          : 8000
        : older
          ? 8000
          : 9000;
  const why: string[] = [];
  if (p.activity === 'sedentary') why.push('You told us you spend most of the day sitting, so moving more is where you can gain the most.');
  else if (p.activity === 'light') why.push('You already move a bit: a few thousand more steps a day is a small change with a big payoff.');
  const reasons = ['hypertension', 'diabetes', 'prediabetes', 'high_cholesterol'].filter(cond);
  if (reasons.length) why.push('Walking lowers blood pressure, blood sugar and triglycerides.');
  why.push(
    older
      ? 'In a study of 47,000 adults, the benefit kept growing up to 6,000-8,000 steps a day from age 60.'
      : 'In a study of 47,000 adults, the benefit kept growing up to 8,000-10,000 steps a day before age 60.'
  );
  let score = 2;
  if (p.activity === 'sedentary') score += 3;
  if (p.activity === 'light') score += 2;
  if (p.activity === 'very_active') score -= 3;
  if (has('lose_weight')) score += 2;
  if (has('general_health') || has('longevity') || has('prevent_disease')) score += 1;
  if (reasons.length) score += 2;
  return {
    score,
    item: {
      kind: 'steps',
      title: `Walk ${fmtSteps(target)} steps a day`,
      subtitle: 'Updated from your wearable',
      target,
      why: why.join(' '),
      how: [
        'A 10-min walk after each main meal',
        'Take calls on foot and use the stairs',
        target <= 6000 ? 'Once this feels easy, we will raise the goal' : 'Your wearable updates progress automatically',
      ],
    },
  };
}

function strength(p: PlanProfile, age: number | null, has: (g: string) => boolean, cond: (c: string) => boolean): Candidate {
  const beginner = p.activity === 'sedentary' || p.activity === 'light' || !p.activity;
  const target = has('performance') || p.activity === 'very_active' ? 3 : beginner ? 2 : 3;
  const why: string[] = [];
  if (has('performance')) why.push('You want to perform better: strength is the base for speed, power and fewer injuries.');
  if (has('lose_weight')) why.push('Keeping muscle while you lose weight keeps your metabolism up.');
  if (cond('diabetes') || cond('prediabetes')) why.push('Muscle is your biggest sink for blood sugar, so it helps control it.');
  if (age != null && age >= 50) why.push('From your 50s, muscle and bone are lost faster unless you train them.');
  why.push('The WHO recommends strength training on 2 or more days a week for every adult.');
  let score = 2;
  if (has('performance')) score += 3;
  if (has('lose_weight')) score += 2;
  if (has('longevity')) score += 2;
  if (has('more_energy')) score += 1;
  if (age != null && age >= 50) score += 1;
  if (cond('diabetes') || cond('prediabetes')) score += 2;
  const older = age != null && age >= 65;
  return {
    score,
    item: {
      kind: 'strength',
      title: `${target} strength sessions a week`,
      subtitle: beginner ? 'Start light: 20-30 minutes is enough' : 'Supports muscle, bones and blood sugar',
      target,
      why: why.join(' '),
      how: [
        `${target} sessions of ${beginner ? '20-30' : '30-45'} min on non-consecutive days`,
        older ? 'Include balance work: standing on one leg, step-ups' : 'Full body: squats, hinges, pushes, pulls',
        'Finish each set with 1-2 reps left in the tank',
      ],
    },
  };
}

function nutrition(p: PlanProfile, has: (g: string) => boolean, cond: (c: string) => boolean): Candidate {
  const drinks = p.alcohol === 'daily' || p.alcohol === 'weekly';
  const alcoholTip = drinks ? ['At least 4 alcohol-free days a week'] : [];
  let score = 2;
  if (has('lose_weight')) score += 2;
  if (has('more_energy')) score += 1;
  if (has('prevent_disease') || has('longevity')) score += 1;
  if (drinks) score += 1;
  const base = { kind: 'nutrition' as const, subtitle: 'Snap your meals to track it', target: 3 };

  if (cond('diabetes') || cond('prediabetes'))
    return {
      score: score + 3,
      item: {
        ...base,
        title: 'Cut down on added sugar',
        why: `You told us about ${cond('diabetes') ? 'diabetes' : 'prediabetes'}. Added sugar and refined flour drive glucose spikes; meals built on protein, fibre and vegetables keep it steady.`,
        how: ['Half the plate vegetables, a quarter protein', 'Swap sugary drinks for water or sparkling water', ...alcoholTip, 'Snap your meals: we track added sugar for you'].slice(0, 3),
      },
    };
  if (cond('hypertension'))
    return {
      score: score + 3,
      item: {
        ...base,
        title: 'Cut down on salt',
        why: 'You told us about high blood pressure. Less salt lowers it within weeks; the WHO advises under 5 g a day, about a teaspoon.',
        how: ['Cook from scratch more often', 'Check labels: bread, cured meats and ready meals hide most salt', ...alcoholTip, 'Season with herbs, lemon or spices'].slice(0, 3),
      },
    };
  if (cond('high_cholesterol') || cond('heart_disease'))
    return {
      score: score + 3,
      item: {
        ...base,
        title: 'Eat the Mediterranean way',
        why: `You told us about ${cond('heart_disease') ? 'heart disease' : 'high cholesterol'}. Olive oil, nuts, legumes and fish instead of processed meat and butter lower LDL cholesterol and heart risk.`,
        how: ['Olive oil as your main fat', 'Legumes 3 times a week, oily fish twice', ...alcoholTip, 'Fewer processed meats and pastries'].slice(0, 3),
      },
    };
  if (has('performance') && !has('lose_weight'))
    return {
      score,
      item: {
        ...base,
        title: 'Protein at every meal',
        why: 'You want to perform better. Spreading protein across your meals helps your muscles recover and adapt to training.',
        how: ['A palm-sized portion of protein at each meal', 'A protein-rich snack after training', ...alcoholTip, 'Carbs around your sessions'].slice(0, 3),
      },
    };
  return {
    score,
    item: {
      ...base,
      title: has('lose_weight') ? 'Protein and vegetables first' : 'Build your plate around real food',
      why: has('lose_weight')
        ? 'You want to lose weight. Starting meals with protein and vegetables keeps you full for longer, so eating less does not feel like a fight.'
        : 'Most of what you eat shapes your energy and your blood markers. Simple plate rules beat strict diets.',
      how: ['Half the plate vegetables, a quarter protein', 'Swap sugary drinks for water or sparkling water', ...alcoholTip, 'Snap your meals to see your week'].slice(0, 3),
    },
  };
}

function sleepItem(p: PlanProfile, has: (g: string) => boolean): Candidate {
  let score = 0;
  if (p.sleep === 'lt6') score += 5;
  if (p.sleep === '6to7') score += 2;
  if (has('sleep_better')) score += 4;
  if (has('more_energy')) score += 2;
  if (has('reduce_stress')) score += 1;
  const why: string[] = [];
  if (p.sleep === 'lt6') why.push('You told us you usually sleep under 6 hours.');
  else if (p.sleep === '6to7') why.push('You usually sleep 6-7 hours, just under what most adults need.');
  if (has('sleep_better')) why.push('Sleeping better is one of your goals.');
  if (has('more_energy')) why.push('More sleep is the fastest way to more energy.');
  why.push('Adults need 7 hours or more: short sleep raises next-day glucose and cortisol and lowers HRV.');
  const target = p.sleep === 'lt6' ? 7 : 7.5;
  return {
    score,
    item: {
      kind: 'sleep',
      title: p.sleep === 'lt6' ? 'Get to 7 hours of sleep' : 'Sleep 7-8 hours',
      subtitle: 'Measured by your wearable',
      target,
      why: why.join(' '),
      how: [
        p.sleep === 'lt6' ? 'Move your bedtime 20 minutes earlier each week' : 'Same wake-up time every day, weekends included',
        'No screens 30 min before bed',
        'Keep the bedroom cool and dark',
      ],
    },
  };
}

function mindfulness(has: (g: string) => boolean, cond: (c: string) => boolean): Candidate {
  let score = 0;
  if (has('reduce_stress')) score += 5;
  if (has('sleep_better')) score += 1;
  if (has('more_energy')) score += 1;
  if (cond('hypertension') || cond('heart_disease')) score += 1;
  return {
    score,
    item: {
      kind: 'mindfulness',
      title: '3 short calm sessions a week',
      subtitle: 'Breathing or body scan, 3-10 min',
      target: 3,
      why: `${has('reduce_stress') ? 'You want to reduce stress. ' : ''}Chronic stress keeps cortisol high and HRV low. A few minutes of slow breathing measurably shifts your nervous system towards recovery.`,
      how: ['Box breathing when you feel tense', 'Body scan before bed', 'Start from a check-in: we suggest the right one'],
    },
  };
}

// Plan por defecto (sin perfil): lo que más beneficio da a casi cualquiera
export function buildPlan(profile?: PlanProfile | null): PlanItem[] {
  const p = profile ?? {};
  const goals = p.goals ?? [];
  const conditions = p.conditions ?? [];
  const has = (g: string) => goals.includes(g);
  const cond = (c: string) => conditions.includes(c);
  const age = ageOf(p.dateOfBirth);
  const candidates = [steps(p, age, has, cond), strength(p, age, has, cond), nutrition(p, has, cond), sleepItem(p, has), mindfulness(has, cond)];
  // Las de más puntos primero; mínimo 3 acciones, como mucho 4, y solo las que aportan (3+ puntos)
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const chosen = sorted.filter((c, i) => i < 3 || (i < 4 && c.score >= 4));
  return chosen.map((c) => c.item);
}

// Qué de las respuestas ha decidido el plan, para enseñarlo al elegir objetivos (vista previa)
export const planSummary = (profile?: PlanProfile | null) => list(buildPlan(profile).map((i) => i.title.toLowerCase()));
