import { AppSection, SECTION_OPTIONS } from './appPrefs';
import { buildPlan, PlanProfile } from '@/logic/plan';

// Qué cambia en la app lo que el usuario contesta en el onboarding: las secciones que se encienden
// (además de lo que decida el propósito) y el plan de partida (src/data/planRepository.ts).
// BORRADOR para decidir con el fundador qué menús van con qué objetivo: basta con cambiar esta tabla.

// Objetivo → secciones que enciende
export const GOAL_SECTIONS: Record<string, AppSection[]> = {
  reproductive_health: ['cycle'], // el ciclo solo se enciende en mujeres (ver sectionsFromAnswers)
  manage_condition: ['medication'],
};

export interface OnboardingAnswers extends PlanProfile {
  takesMedication?: boolean;
}

// Secciones que se encienden con estas respuestas
export function sectionsFromAnswers(a: OnboardingAnswers): AppSection[] {
  const on = new Set<AppSection>();
  for (const g of a.goals ?? []) for (const s of GOAL_SECTIONS[g] ?? []) on.add(s);
  if (a.takesMedication) on.add('medication');
  // El seguimiento del ciclo (reglas, predicción) es solo para mujeres
  if (a.sex !== 'female') on.delete('cycle');
  return [...on];
}

// Lo que se enseña bajo los objetivos: "así queda tu app"
export function answersPreview(a: OnboardingAnswers): { plan: string[]; sections: string[] } {
  return {
    plan: buildPlan(a).map((i) => i.title),
    sections: sectionsFromAnswers(a).map((id) => SECTION_OPTIONS.find((o) => o.id === id)?.title ?? id),
  };
}
