import type { PlanVersion } from '@/data/planVersions';

// Desde el 2026-11-06 el paciente solo ve los planes que le manda un especialista (fundador: el plan
// automático lo sustituyen los objetivos). Las versiones que se guardaron antes desde una analítica subida
// («Actualizar mi plan») o del informe siguen en la base de datos, pero ya no se enseñan.
export const specialistPlans = (versions: PlanVersion[]): PlanVersion[] =>
  versions.filter((v) => v.source === 'professional').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
