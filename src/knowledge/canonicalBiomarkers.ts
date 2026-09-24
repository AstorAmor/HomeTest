import metabolico from '../../knowledge/biomarcadores/metabolico.json';
import lipidico from '../../knowledge/biomarcadores/lipidico.json';
import renal from '../../knowledge/biomarcadores/renal.json';
import hepatico from '../../knowledge/biomarcadores/hepatico.json';
import electrolitos from '../../knowledge/biomarcadores/electrolitos.json';
import hematologia from '../../knowledge/biomarcadores/hematologia.json';
import endocrino from '../../knowledge/biomarcadores/endocrino.json';
import vitales from '../../knowledge/biomarcadores/vitales.json';
import tiroides from '../../knowledge/biomarcadores/tiroides.json';
import autoinmunidad from '../../knowledge/biomarcadores/autoinmunidad.json';
import regulacionInmune from '../../knowledge/biomarcadores/regulacion_inmune.json';
import hormonas from '../../knowledge/biomarcadores/hormonas.json';
import saludFemenina from '../../knowledge/biomarcadores/salud_femenina.json';
import saludMasculina from '../../knowledge/biomarcadores/salud_masculina.json';
import toxinasAmbientales from '../../knowledge/biomarcadores/toxinas_ambientales.json';
import nutrientes from '../../knowledge/biomarcadores/nutrientes.json';
import pancreas from '../../knowledge/biomarcadores/pancreas.json';
import orina from '../../knowledge/biomarcadores/orina.json';
import edadBiologica from '../../knowledge/biomarcadores/edad_biologica.json';
import extractedNameAliases from '../../knowledge/mapping/extracted-name-aliases.json';
import { normalizeName } from '@/utils/normalizeName';
import { BiomarcadoresFile, CanonicalBiomarker } from '@/types/knowledge';

const FILES = [
  metabolico,
  lipidico,
  renal,
  hepatico,
  electrolitos,
  hematologia,
  endocrino,
  vitales,
  tiroides,
  autoinmunidad,
  regulacionInmune,
  hormonas,
  saludFemenina,
  saludMasculina,
  toxinasAmbientales,
  nutrientes,
  pancreas,
  orina,
  edadBiologica,
] as BiomarcadoresFile[];

// Registro plano canonical_id -> biomarcador, construido una vez a partir de
// knowledge/biomarcadores/*.json. Punto unico de lectura de la base de
// conocimiento clinico desde la app.
const REGISTRY: Record<string, CanonicalBiomarker> = FILES.reduce(
  (acc, file) => {
    for (const biomarker of file.biomarcadores) {
      acc[biomarker.canonical_id] = biomarker;
    }
    return acc;
  },
  {} as Record<string, CanonicalBiomarker>
);

// Mapa nombre-extraido -> canonical_id. Se construye en dos pasadas:
// 1) automaticamente a partir de canonical_name + aliases de cada
//    biomarcador (ya curados a mano al crear cada entrada, no son similitud
//    difusa: son coincidencia exacta tras normalizar).
// 2) knowledge/mapping/extracted-name-aliases.json aplicado encima, para
//    variantes de extraccion que no queramos meter en la lista "oficial"
//    de aliases de un biomarcador. Si hay conflicto, gana el mapping a mano.
function buildNameToCanonicalId(): Record<string, string> {
  const map: Record<string, string> = {};

  for (const biomarker of Object.values(REGISTRY)) {
    const names = [biomarker.canonical_name, ...biomarker.aliases];
    for (const name of names) {
      const key = normalizeName(name);
      if (map[key] && map[key] !== biomarker.canonical_id) {
        console.warn(
          `[knowledge] Alias "${name}" normaliza a "${key}", que ya apunta a ${map[key]} -- se ignora el segundo match de ${biomarker.canonical_id}.`
        );
        continue;
      }
      map[key] = biomarker.canonical_id;
    }
  }

  return { ...map, ...extractedNameAliases.aliases };
}

const NAME_TO_CANONICAL_ID: Record<string, string> = buildNameToCanonicalId();

export function getCanonicalBiomarker(canonicalId: string): CanonicalBiomarker | null {
  return REGISTRY[canonicalId] ?? null;
}

export function getAllCanonicalBiomarkers(): CanonicalBiomarker[] {
  return Object.values(REGISTRY);
}

// Busca el canonical_id para un nombre tal como lo extrae la IA de una
// analitica (texto libre). Devuelve null si no hay mapeo conocido -- nunca
// adivina por similitud.
export function findCanonicalIdForExtractedName(extractedName: string): string | null {
  return NAME_TO_CANONICAL_ID[normalizeName(extractedName)] ?? null;
}

export function getCanonicalBiomarkerForExtractedName(
  extractedName: string
): CanonicalBiomarker | null {
  const canonicalId = findCanonicalIdForExtractedName(extractedName);
  return canonicalId ? getCanonicalBiomarker(canonicalId) : null;
}
