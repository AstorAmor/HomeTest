import { showSamples } from '@/data/dataMode';
import { labUploadRepository } from '@/data/labUploads';
import { markerIdForExtractedName } from '@/data/markerMatching';
import { profileRepository, UserProfile } from '@/data/profileRepository';
import { currentReport } from '@/data/reportRepository';
import { loadGutContext } from '@/data/digestionRepository';
import { analyseGut } from '@/logic/gutPatterns';
import type { FoodGroup } from '@/logic/foodGroups';
import { latestUpload } from '@/logic/markerProjection';
import type { LabFlag } from '@/logic/dietPlanner';
import { getRangeStatus } from '@/utils/rangeStatus';

// Lo que el menú sabe de la persona sin preguntarle: su última analítica (la subida más reciente; en
// cuentas de prueba, la de ejemplo), su perfil (sexo, edad, altura, peso, actividad, enfermedades) y lo
// que su diario de Digestión apunta que le sienta mal.

export interface DietContext {
  labs: LabFlag[];
  labSource: 'upload' | 'sample' | null;
  labDate: string | null;
  profile: UserProfile | null;
  age: number | null;
  gutSuspects: FoodGroup[]; // patrones "probable" o "bastante claro" del diario de Digestión
}

export function ageFrom(dob?: string | null, now = new Date()): number | null {
  if (!dob) return null;
  const b = new Date(`${dob}T12:00:00`);
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return Number.isFinite(a) ? a : null;
}

export async function labFlags(): Promise<Pick<DietContext, 'labs' | 'labSource' | 'labDate'>> {
  const up = latestUpload(await labUploadRepository.getAll().catch(() => []));
  if (up) {
    const labs: LabFlag[] = [];
    for (const sec of up.data.secciones)
      for (const p of sec.parametros) {
        if (typeof p.valor !== 'number') continue;
        const marker = markerIdForExtractedName(p.nombre);
        if (!marker) continue;
        const st = getRangeStatus(p.valor, p.rango_min, p.rango_max);
        if (st === 'por_encima' || st === 'por_debajo') labs.push({ marker, status: st === 'por_encima' ? 'high' : 'low', value: p.valor });
      }
    return { labs, labSource: 'upload', labDate: up.testDate ?? up.createdAt.slice(0, 10) };
  }
  if (showSamples()) {
    const labs: LabFlag[] = [];
    for (const s of currentReport.sections)
      for (const m of s.markers) {
        if (m.flag === 'alto' || m.flag === 'limite_alto' || m.flag === 'critico') labs.push({ marker: m.marker_id, status: 'high' });
        else if (m.flag === 'bajo' || m.flag === 'limite_bajo') labs.push({ marker: m.marker_id, status: 'low' });
      }
    return { labs, labSource: 'sample', labDate: null };
  }
  return { labs: [], labSource: null, labDate: null };
}

export async function loadDietContext(): Promise<DietContext> {
  const [l, profile, gut] = await Promise.all([labFlags(), profileRepository.get().catch(() => null), loadGutContext().catch(() => null)]);
  let gutSuspects: FoodGroup[] = [];
  if (gut && !gut.sample) {
    try {
      gutSuspects = analyseGut(gut)
        .patterns.filter((p) => p.kind === 'food' && p.factor && p.confidence !== 'hint')
        .map((p) => p.factor!) as FoodGroup[];
    } catch {
      gutSuspects = [];
    }
  }
  return { ...l, profile, age: ageFrom(profile?.dateOfBirth), gutSuspects: [...new Set(gutSuspects)] };
}
