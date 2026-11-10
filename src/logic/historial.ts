// Tu historial (Mis datos): alergias, grupo sanguíneo, vacunas e historia clínica (cirugías, ingresos,
// enfermedades… por categorías), y la tarjeta de emergencia que se hace con ellos. Lógica pura: tipos, listas para elegir, normalizar lo
// guardado, la demo y el texto del QR. Se guarda en user_flags 'historial.v1' (data/historialRepository).
//
// Fuera de esta primera versión (necesitan más piezas):
// - Importar desde un PDF o una foto con IA (Edge Function + DPA del proveedor + texto del abogado).
// - Compartirlo con un profesional: seis casillas nuevas en «Qué» de la pantalla de compartir
//   (ShareScope + migración del CHECK de data_shares + mapeo FHIR AllergyIntolerance/Immunization).
import { t } from '@/i18n';
import { qrCells } from '@/logic/qr';

export type AllergyGroup = 'drugs' | 'food' | 'other';
export interface Allergy {
  name: string; // de la lista (clave en inglés, se traduce) o escrita por la persona (custom)
  group: AllergyGroup;
  custom?: boolean;
}
export const BLOOD_GROUPS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];
// Con el signo menos de verdad; en español, el grupo O se escribe con cero (0−, 0+)
export const bloodGroupLabel = (g: BloodGroup) => t(g.replace('-', '−'));
export interface VaccineDose {
  id: string;
  name: string; // de la lista (clave en inglés) o escrita (custom)
  custom?: boolean;
  month: number | null; // 1-12; el mes cuenta en las de viaje (fiebre amarilla…)
  year: number | null;
}
// Historia clínica: lo que te ha pasado, por categorías (fundador, 2026-11-05: «eventos», no
// «problemas»). Las cirugías van aquí, como una categoría más.
export type EventCat = 'surgery' | 'hospital' | 'serious' | 'chronic' | 'injury' | 'other';
export const EVENT_CATS: EventCat[] = ['surgery', 'hospital', 'serious', 'chronic', 'injury', 'other'];
export const EVENT_CAT_NAME: Record<EventCat, string> = {
  surgery: 'Surgeries',
  hospital: 'Hospital stays',
  serious: 'Serious illnesses',
  chronic: 'Chronic illnesses',
  injury: 'Accidents and injuries',
  other: 'Other events',
};
export const EVENT_PLACEHOLDER: Record<EventCat, string> = {
  surgery: 'For example, appendix',
  hospital: 'For example, pneumonia',
  serious: 'For example, meningitis',
  chronic: 'For example, asthma',
  injury: 'For example, broken wrist',
  other: 'What happened',
};
export interface HistoryEvent {
  id: string;
  cat: EventCat;
  name: string;
  year: number | null;
}

// Tarjeta de emergencia: qué datos lleva (los escribe aquí o salen del historial) y cuáles se ven.
// Recomendados: nombre, grupo, alergias a medicamentos y contacto; el resto, si quieres.
export type CardField = 'name' | 'blood' | 'drugAllergies' | 'contact' | 'notices' | 'otherAllergies' | 'address';
export const CARD_FIELDS: CardField[] = ['name', 'blood', 'drugAllergies', 'contact', 'notices', 'otherAllergies', 'address'];
export const RECOMMENDED_FIELDS: CardField[] = ['name', 'blood', 'drugAllergies', 'contact'];
const DEFAULT_SHOW: Record<CardField, boolean> = { name: true, blood: true, drugAllergies: true, contact: true, notices: true, otherAllergies: false, address: true };
// «A tener en cuenta»: lo más habitual para quien te atienda; lo que no esté se escribe
export const NOTICE_CATALOG = [
  'Diabetes',
  'I take anticoagulants (Sintrom…)',
  "I'm pregnant",
  'Epilepsy',
  'I have a pacemaker',
  'Asthma',
  'Heart condition',
  'I wear contact lenses',
  'Organ donor',
];
export const NOTICES_MAX = 8;
export interface CardNotice {
  name: string; // de la lista (clave en inglés) o escrito (custom)
  custom?: boolean;
}
// Fondo de la versión Bloqueo (fundador, 2026-11-06: «otros patrones: claros, el verde…»): los de la marca o
// tu foto (la foto no viaja con la tarjeta: solo está en el móvil donde la elegiste)
export type LockBg = 'green' | 'layers' | 'cream' | 'sand' | 'photo';
export const LOCK_PATTERNS: Exclude<LockBg, 'photo'>[] = ['green', 'layers', 'cream', 'sand'];
export const LOCK_BG_NAME: Record<LockBg, string> = { green: 'Green', layers: 'Layers', cream: 'Cream', sand: 'Sand', photo: 'Your photo' };
const isLockBg = (v: unknown): v is LockBg => typeof v === 'string' && (v === 'photo' || (LOCK_PATTERNS as string[]).includes(v));

// El que se pinta: el elegido; «tu foto» sin foto en este móvil, el verde; sin elegir (tarjetas de antes),
// la foto si la hay y si no el verde
export function lockBackground(card: Pick<CardData, 'lockBg'>, hasPhoto: boolean): LockBg {
  const b = card.lockBg ?? (hasPhoto ? 'photo' : 'green');
  return b === 'photo' && !hasPhoto ? 'green' : b;
}

export interface CardData {
  fullName: string; // nombre y apellidos de la persona
  phone: string; // teléfono de emergencia
  contact: string; // de quién es ese teléfono (opcional)
  address: string;
  notices: CardNotice[];
  show: Record<CardField, boolean>;
  lockBg?: LockBg; // fondo de la versión Bloqueo
}
export interface Historial {
  allergies: Allergy[];
  bloodGroup: BloodGroup | null;
  vaccines: VaccineDose[];
  events: HistoryEvent[];
  card: CardData;
}

// Listas para elegir; lo que no esté entra por «Otra»
export const ALLERGY_GROUPS: AllergyGroup[] = ['drugs', 'food', 'other'];
export const ALLERGY_GROUP_NAME: Record<AllergyGroup, string> = { drugs: 'Medicines', food: 'Foods', other: 'Other allergies' };
export const ALLERGY_CATALOG: Record<AllergyGroup, string[]> = {
  drugs: ['Penicillin', 'Amoxicillin', 'Ibuprofen and other NSAIDs', 'Aspirin', 'Sulfonamides', 'Metamizole', 'Iodinated contrast'],
  food: ['Shellfish', 'Fish', 'Tree nuts', 'Peanut', 'Egg', 'Milk', 'Soy', 'Wheat'],
  other: ['Latex', 'Pollen', 'Dust mites', 'Cats or dogs', 'Bee or wasp sting'],
};
export const VACCINE_CATALOG = [
  'Flu vaccine',
  'COVID-19',
  'Tetanus and diphtheria',
  'MMR (measles, mumps, rubella)',
  'Hepatitis A',
  'Hepatitis B',
  'HPV',
  'Pneumococcal',
  'Shingles',
  'Meningococcal',
  'Chickenpox',
  'Yellow fever',
  'Typhoid fever',
];
// En español van en minúscula (es.ts ya tiene 'May' → 'may'); la rueda pone la mayúscula
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const FIRST_YEAR = 1940;
export const monthName = (i: number) => {
  const m = t(MONTHS[i]);
  return m.charAt(0).toUpperCase() + m.slice(1);
};

export const emptyCard = (): CardData => ({ fullName: '', phone: '', contact: '', address: '', notices: [], show: { ...DEFAULT_SHOW } });
export const emptyHistorial = (): Historial => ({
  allergies: [],
  bloodGroup: null,
  vaccines: [],
  events: [],
  card: emptyCard(),
});

const str = (v: unknown, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const intIn = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);

// Lo guardado puede venir de otra versión o a medias: se queda solo lo que tiene sentido
export function normalizeHistorial(raw: unknown, thisYear = new Date().getFullYear()): Historial {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const seen = new Set<string>();
  const allergies: Allergy[] = [];
  for (const a of arr(r.allergies)) {
    const typed = str(a.name, 60);
    const g = ALLERGY_GROUPS.includes(a.group as AllergyGroup) ? (a.group as AllergyGroup) : 'other';
    const hit = ALLERGY_CATALOG[g].includes(typed) ? { name: typed, group: g } : catalogAllergy(typed);
    const item: Allergy = hit ?? { name: typed, group: g, custom: true };
    const key = fold(item.name);
    if (!typed || seen.has(key)) continue;
    seen.add(key);
    allergies.push(item);
  }
  const bloodGroup = BLOOD_GROUPS.includes(r.bloodGroup as BloodGroup) ? (r.bloodGroup as BloodGroup) : null;
  const vaccines: VaccineDose[] = arr(r.vaccines)
    .map((v, i) => {
      const name = str(v.name, 60);
      const custom = !VACCINE_CATALOG.includes(name);
      return { id: str(v.id, 40) || `v${i + 1}`, name, ...(custom ? { custom: true } : {}), month: intIn(v.month, 1, 12), year: intIn(v.year, FIRST_YEAR, thisYear) };
    })
    .filter((v) => v.name)
    .map((v) => (v.year == null ? { ...v, month: null } : v)); // un mes sin año no dice nada
  // Antes había dos listas (cirugías e historia clínica): pasan a ser categorías
  const items = (list: unknown, fallback: EventCat): HistoryEvent[] =>
    arr(list)
      .map((x, i) => ({
        id: str(x.id, 40) || `h${i + 1}`,
        cat: EVENT_CATS.includes(x.cat as EventCat) ? (x.cat as EventCat) : fallback,
        name: str(x.name, 80),
        year: intIn(x.year, FIRST_YEAR, thisYear),
      }))
      .filter((x) => x.name);
  const events = Array.isArray(r.events) ? items(r.events, 'other') : [...items(r.surgeries, 'surgery'), ...items(r.conditions, 'other')];
  return { allergies, bloodGroup, vaccines, events, card: normalizeCard(r.card) };
}

function normalizeCard(raw: unknown): CardData {
  const c = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const show = { ...DEFAULT_SHOW };
  const rs = c.show && typeof c.show === 'object' ? (c.show as Record<string, unknown>) : {};
  for (const f of CARD_FIELDS) if (typeof rs[f] === 'boolean') show[f] = rs[f] as boolean;
  const seen = new Set<string>();
  const notices: CardNotice[] = [];
  for (const n of arr(c.notices)) {
    const typed = str(n.name, 60);
    const item = noticeItem(typed);
    if (!typed || seen.has(fold(item.name)) || notices.length >= NOTICES_MAX) continue;
    seen.add(fold(item.name));
    notices.push(item);
  }
  const card: CardData = { fullName: str(c.fullName, 80), phone: str(c.phone, 30), contact: str(c.contact, 60), address: str(c.address, 120), notices, show };
  if (isLockBg(c.lockBg)) card.lockBg = c.lockBg;
  return card;
}

// Persona de ejemplo (solo cuentas de prueba / demo): nombres y teléfono inventados
export const demoHistorial = (): Historial => ({
  allergies: [
    { name: 'Penicillin', group: 'drugs' },
    { name: 'Shellfish', group: 'food' },
  ],
  bloodGroup: 'A+',
  vaccines: [
    { id: 'v1', name: 'Flu vaccine', month: 10, year: 2026 },
    { id: 'v2', name: 'COVID-19', month: 4, year: 2021 },
    { id: 'v3', name: 'COVID-19', month: 5, year: 2021 },
    { id: 'v4', name: 'COVID-19', month: 12, year: 2021 },
    { id: 'v5', name: 'Yellow fever', month: 3, year: 2019 },
    { id: 'v6', name: 'Hepatitis B', month: null, year: 2004 },
    { id: 'v7', name: 'Tetanus and diphtheria', month: null, year: null },
  ],
  events: [
    { id: 'h1', cat: 'surgery', name: 'Apendicectomía', year: 2009 },
    { id: 'h2', cat: 'chronic', name: 'Asma leve', year: 1998 },
    { id: 'h3', cat: 'injury', name: 'Fractura de muñeca', year: 2015 },
  ],
  card: { ...emptyCard(), fullName: 'Ana García López', phone: '600 000 000', contact: 'Luis (pareja)', notices: [{ name: 'Asthma' }] },
});

export const allergyLabel = (a: Allergy) => (a.custom ? a.name : t(a.name));
export const vaccineLabel = (v: { name: string; custom?: boolean }) => (v.custom ? v.name : t(v.name));
export const drugAllergies = (h: Historial) => h.allergies.filter((a) => a.group === 'drugs');
export const otherAllergies = (h: Historial) => h.allergies.filter((a) => a.group !== 'drugs');
export const noticeLabel = (n: CardNotice) => (n.custom ? n.name : t(n.name));

// Lo que se escribe a mano y ya está en una lista cuenta como el de la lista: sin tildes ni mayúsculas,
// y vale el nombre entero, lo de antes del paréntesis o lo de dentro («Metamizol» = «Metamizol (Nolotil)»,
// «Sintrom» = «Tomo anticoagulantes (Sintrom…)»), en el idioma de la app o en inglés.
const fold = (x: string) =>
  x
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/…|\.\.\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const aliases = (label: string): string[] => {
  const m = label.match(/^(.*?)\s*\((.*)\)\s*$/);
  return (m ? [label, m[1], m[2]] : [label]).map(fold).filter(Boolean);
};
const inCatalog = (typed: string, key: string) => {
  const f = fold(typed);
  return !!f && [...aliases(key), ...aliases(t(key))].includes(f);
};
export function catalogAllergy(typed: string): { name: string; group: AllergyGroup } | null {
  for (const group of ALLERGY_GROUPS) for (const name of ALLERGY_CATALOG[group]) if (inCatalog(typed, name)) return { name, group };
  return null;
}
const noticeItem = (typed: string): CardNotice => {
  const key = NOTICE_CATALOG.find((k) => k === typed || inCatalog(typed, k));
  return key ? { name: key } : { name: typed, custom: true };
};
// ¿Ya tienes esta alergia? (la de la lista o una escrita que es la misma)
export const hasAllergy = (h: Historial, typed: string) => {
  const hit = catalogAllergy(typed);
  const f = fold(hit ? hit.name : typed);
  return h.allergies.some((a) => fold(a.name) === f);
};

// Tocar un aviso de la lista: si lo tienes, se quita; si no, se añade (como mucho NOTICES_MAX)
export function toggleNotice(card: CardData, name: string): CardData {
  const n = name.trim();
  if (!n) return card;
  const item = noticeItem(n);
  const same = (x: CardNotice) => fold(x.name) === fold(item.name);
  if (card.notices.some(same)) return { ...card, notices: card.notices.filter((x) => !same(x)) };
  if (card.notices.length >= NOTICES_MAX) return card;
  return { ...card, notices: [...card.notices, item] };
}

export const newId = (prefix: string, ids: string[]) => {
  const n = Math.max(0, ...ids.map((id) => Number(id.replace(/^\D+/, '')) || 0)) + 1;
  return `${prefix}${n}`;
};

// Tocar una de la lista: si la tienes, se quita; si no, se añade
// Lo escrito que ya está en la lista entra como el de la lista, en su grupo (aunque eligieras otro)
export function toggleAllergy(h: Historial, name: string, group: AllergyGroup): Historial {
  const typed = name.trim();
  if (!typed) return h;
  const hit = ALLERGY_CATALOG[group].includes(typed) ? { name: typed, group } : catalogAllergy(typed);
  const item: Allergy = hit ?? { name: typed, group, custom: true };
  const same = (a: Allergy) => fold(a.name) === fold(item.name);
  return { ...h, allergies: h.allergies.some(same) ? h.allergies.filter((a) => !same(a)) : [...h.allergies, item] };
}

// Vacunas: cada dosis, su línea; por vacuna en el orden en que se añadieron y, dentro, por fecha
// (las que no tienen fecha, al final)
const doseKey = (v: VaccineDose) => (v.year == null ? null : v.year * 100 + (v.month ?? 0));
export function vaccineGroups(list: VaccineDose[]): { name: string; custom?: boolean; doses: VaccineDose[] }[] {
  const order: string[] = [];
  const by: Record<string, VaccineDose[]> = {};
  for (const v of list) {
    if (!by[v.name]) {
      by[v.name] = [];
      order.push(v.name);
    }
    by[v.name].push(v);
  }
  return order.map((name) => ({
    name,
    custom: by[name][0].custom,
    doses: [...by[name]].sort((x, y) => {
      const a = doseKey(x);
      const b = doseKey(y);
      if (a == null) return b == null ? 0 : 1;
      if (b == null) return -1;
      return a - b;
    }),
  }));
}
export function doseDate(v: { month: number | null; year: number | null }, short = false): string {
  if (v.year == null) return t('No date');
  if (v.month == null) return String(v.year);
  const m = t(MONTHS[v.month - 1]); // en español ya va en minúscula
  return short ? `${m.slice(0, 3)} ${v.year}` : t('{month} {year}', { month: m, year: v.year });
}
export function lastDose(list: VaccineDose[]): VaccineDose | null {
  const dated = list.filter((v) => v.year != null);
  if (!dated.length) return null;
  return dated.reduce((best, v) => (doseKey(v)! > doseKey(best)! ? v : best));
}

// Textos cortos de las fichas de Mis datos
export function historialSummary(h: Historial) {
  const names = new Set(h.vaccines.map((v) => v.name)).size;
  const last = lastDose(h.vaccines);
  return {
    allergies: h.allergies.length ? h.allergies.map(allergyLabel).join(' · ') : t('None added'),
    bloodGroup: h.bloodGroup ? bloodGroupLabel(h.bloodGroup) : t('Not added'),
    vaccines: names
      ? [h.vaccines.length > names ? t('{n} doses', { n: h.vaccines.length }) : '', last ? t('Last: {name}, {date}', { name: vaccineLabel(last).toLowerCase(), date: doseDate(last) }) : t('No dates')]
          .filter(Boolean)
          .join('. ')
      : t('Add them from the list'),
    vaccineCount: names,
    events: h.events.length ? t(h.events.length === 1 ? '{n} event' : '{n} events', { n: h.events.length }) : t('None added'),
    eventNames: h.events.length ? h.events.map((s) => (s.year ? `${s.name} · ${s.year}` : s.name)).join(', ') : t('Surgeries, hospital stays, illnesses…'),
  };
}

// ===== Tarjeta de emergencia =====
// Lo que se ve, en orden. Un dato recomendado que falta sale «Sin indicar» (nunca «ninguna»: que no lo
// hayas puesto no quiere decir que no tengas); uno opcional sin nada no sale. En el fondo de pantalla
// de bloqueo no va la dirección: la vería cualquiera que coja tu móvil.
export interface CardSection {
  field: CardField;
  label: string;
  text: string;
}
export interface CardContent {
  name: string | null; // null: no se enseña
  blood: string | null;
  sections: CardSection[];
}
// Los datos que lleva, antes de ponerlos en texto (la tarjeta y el QR salen de aquí):
// null = no se enseña; '' o [] en un recomendado = se enseña «Sin indicar».
export interface CardFacts {
  name: string | null;
  blood: BloodGroup | '' | null;
  drugs: Allergy[] | null; // recomendado: sale aunque no haya ninguna
  notices: CardNotice[] | null;
  others: Allergy[] | null;
  contact: { name: string; phone: string } | null; // sin teléfono, nada (fundador, 2026-11-05)
  address: string | null;
}
export function cardFacts(h: Historial, opts: { lock?: boolean } = {}): CardFacts {
  const c = h.card;
  const on = (f: CardField) => c.show[f] && !(opts.lock && f === 'address');
  const list = <T,>(f: CardField, xs: T[], recommended = false) => (on(f) && (xs.length > 0 || recommended) ? xs : null);
  const phone = c.phone.trim();
  const address = c.address.trim();
  return {
    name: on('name') ? c.fullName.trim() : null,
    blood: on('blood') ? (h.bloodGroup ?? '') : null,
    drugs: list('drugAllergies', drugAllergies(h), true),
    notices: list('notices', c.notices),
    others: list('otherAllergies', otherAllergies(h)),
    contact: on('contact') && phone ? { name: c.contact.trim(), phone } : null,
    address: on('address') && address ? address : null,
  };
}

export function cardContent(h: Historial, opts: { lock?: boolean } = {}): CardContent {
  const f = cardFacts(h, opts);
  const none = t('Not stated');
  const sections: CardSection[] = [];
  const add = (field: CardField, label: string, text: string) => sections.push({ field, label, text: text || none });
  if (f.drugs) add('drugAllergies', t('Drug allergies'), f.drugs.map(allergyLabel).join(', '));
  if (f.notices) add('notices', t('Important'), f.notices.map(noticeLabel).join(' · '));
  if (f.others) add('otherAllergies', t('Food and other allergies'), f.others.map(allergyLabel).join(', '));
  if (f.contact) add('contact', t('In an emergency, call'), f.contact.name ? `${f.contact.name} · ${f.contact.phone}` : f.contact.phone);
  if (f.address) add('address', t('Address'), f.address);
  return {
    name: f.name == null ? null : f.name || none,
    blood: f.blood == null ? null : f.blood ? bloodGroupLabel(f.blood) : none,
    sections,
  };
}

// El QR lleva texto plano: lo lee la cámara de cualquier móvil sin conexión y no se publica en ningún
// servidor. Lleva lo mismo que se ve en la tarjeta, en el idioma de la app. (2026-11-05 se probó un enlace a
// una página con el formato de la tarjeta, pero necesita internet en el móvil que escanea; el fundador
// prefiere que se lea sin conexión.)
export function emergencyQrText(h: Historial, opts: { lock?: boolean } = {}): string {
  if (opts.lock) return lockQr(h).text;
  const k = cardContent(h, opts);
  return [
    `${t('EMERGENCY CARD')} · KUOVA HEALTH`,
    ...(k.name != null ? [`${t('Name')}: ${k.name}`] : []),
    ...(k.blood != null ? [`${t('Blood group')}: ${k.blood}`] : []),
    ...k.sections.map((x) => `${x.label}: ${x.text}`),
  ].join('\n');
}
// ===== El QR del fondo de pantalla de bloqueo (fundador, 2026-11-09: «más pequeño», dos veces) =====
// Un QR más pequeño solo se lee de lejos si lleva menos texto. Medido con un lector de móvil (zxing) sobre
// la pantalla fotografiada a 20-30 cm, con fotogramas de 1080 de ancho: con 380 px de lado se lee a 20-25 cm
// hasta la versión 12 (65 módulos, unos 155 bytes con el nivel H). Por eso aquí las etiquetas van cortas
// (solo «EMERGENCIA» arriba, el nombre sin «Nombre:», «Llamar a» en vez de «En caso de emergencia, llamar
// a») y, si aun así no cabe, el QR crece (EmergencyCard, lockQrBox) en vez de recortar. Pasada la
// versión 18 (unos 500 px), se queda fuera lo menos urgente, en este orden: las otras
// alergias; los últimos avisos o alergias a medicamentos de la lista más larga («y N más»); de quién es el
// teléfono (el número nunca), y el nombre se acorta. La pantalla de la tarjeta dice qué se ha quedado fuera.
export const LOCK_QR_MAX_MODULES = 89; // versión 18
export interface LockQr {
  text: string;
  modules: number; // módulos por lado
  cut: string[]; // lo que no cabe, para decírselo a la persona
}
let lockCache: { key: string; out: LockQr } | null = null;
export function lockQr(h: Historial): LockQr {
  const f = cardFacts(h, { lock: true });
  const none = t('Not stated');
  let name = f.name;
  const drugs = f.drugs ? f.drugs.map(allergyLabel) : null;
  const notices = f.notices ? f.notices.map(noticeLabel) : null;
  let others = f.others ? f.others.map(allergyLabel) : null;
  let who = f.contact?.name ?? '';
  let lessDrugs = 0;
  let lessNotices = 0;
  const list = (xs: string[], n: number, sep: string) => (n ? t('{list} and {n} more', { list: xs.join(sep), n }) : xs.join(sep));
  const build = () =>
    [
      t('EMERGENCY'),
      ...(name == null ? [] : [name || `${t('Name')}: ${none}`]),
      ...(f.blood == null ? [] : [`${t('Blood group')}: ${f.blood ? bloodGroupLabel(f.blood) : none}`]),
      ...(drugs == null ? [] : [`${t('Drug allergies')}: ${drugs.length ? list(drugs, lessDrugs, ', ') : none}`]),
      ...(notices == null ? [] : [`${t('Important')}: ${list(notices, lessNotices, ' · ')}`]),
      ...(others == null ? [] : [`${t('Food and other allergies')}: ${others.join(', ')}`]),
      ...(f.contact ? [`${t('Who to call')}: ${who ? `${who} · ` : ''}${f.contact.phone}`] : []),
    ].join('\n');
  const key = build();
  if (lockCache?.key === key) return lockCache.out;
  const cut: string[] = [];
  // toqr no admite más de unos 1.200 bytes con el nivel H: lo que no entra en un QR, tampoco cabe
  const fits = () => {
    try {
      return qrCells(build()).size <= LOCK_QR_MAX_MODULES;
    } catch {
      return false;
    }
  };
  if (others && !fits()) {
    cut.push(...others);
    others = null;
  }
  while (!fits() && ((drugs?.length ?? 0) > 1 || (notices?.length ?? 0) > 1)) {
    const d = drugs && drugs.length > 1 ? drugs.join().length : -1;
    const n = notices && notices.length > 1 ? notices.join().length : -1;
    if (n >= d) {
      cut.push(notices!.pop()!);
      lessNotices++;
    } else {
      cut.push(drugs!.pop()!);
      lessDrugs++;
    }
  }
  if (who && !fits()) {
    cut.push(who);
    who = '';
  }
  if (name && name.length > 30 && !fits()) name = `${name.slice(0, 29).trim()}…`;
  const text = build();
  const out = { text, modules: qrCells(text).size, cut };
  lockCache = { key, out };
  return out;
}

// Falta algo de lo recomendado que se enseña (para avisar, no para impedir hacerla)
export function emergencyMissing(h: Historial): string[] {
  const out: string[] = [];
  if (h.card.show.name && !h.card.fullName.trim()) out.push(t('your name'));
  if (h.card.show.blood && !h.bloodGroup) out.push(t('your blood group'));
  return out;
}

// Parte un texto en líneas de como mucho `max` caracteres (sin cortar palabras) y como mucho `lines`;
// si sobra, la última acaba en «…» (la tarjeta es SVG: no hay ajuste de línea automático)
export function wrapLines(text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= max) cur += ' ' + w;
    else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  if (out.length <= lines) return out;
  const kept = out.slice(0, lines);
  kept[lines - 1] = `${kept[lines - 1].replace(/[,;]$/, '')}…`;
  return kept;
}
