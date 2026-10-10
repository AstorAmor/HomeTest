import {
  AMSTERDAM_TUMOURS,
  AGE_LABEL,
  areFirstDegree,
  BETHESDA_TUMOURS,
  CANCER_LABEL,
  FHAT,
  MANCHESTER,
  PAT,
  RELATIONS,
  under50,
} from '@/data/genetics/scoring';
import {
  CancerEntry,
  FamilyHistoryAnswers,
  GeneticRiskLevel,
  GeneticsAssessment,
  ManchesterScore,
  Relative,
  TriageId,
} from '@/types/familyHistory';
import { t } from '@/i18n';

// "Know your roots": motor puro (sin React) que puntúa los antecedentes familiares con las tres
// herramientas validadas y criterios de Lynch, y dice qué recordarle al médico. Explicable a
// propósito: cada nivel lleva sus razones. No es un diagnóstico (ver evidence.ts "family_history").
// PENDIENTE DE REVISIÓN por el asesor médico.

type Side = 'maternal' | 'paternal';
const SIDES: Side[] = ['maternal', 'paternal'];

// Personas de una rama: las de esa rama + las compartidas (el usuario, hermanos, hijos, sobrinos)
const inLineage = (r: Relative, side: Side) => {
  const l = RELATIONS[r.relation].lineage;
  return l === side || l === 'both';
};

const isMale = (r: Relative, selfSex?: 'female' | 'male') =>
  r.relation === 'self' ? selfSex === 'male' : RELATIONS[r.relation].sex === 'M';

// ── PAT ────────────────────────────────────────────────────────────────────────────────────────
function patForPerson(r: Relative, selfSex?: 'female' | 'male'): number {
  let pts = 0;
  for (const c of r.cancers) {
    if (c.type === 'breast') {
      const one = isMale(r, selfSex) ? PAT.maleBreastAnyAge : under50(c.age) ? PAT.breastUnder50 : PAT.breast50plus;
      pts += c.bilateral ? one * PAT.bilateralFactor : one;
    } else if (c.type === 'ovarian') {
      pts += PAT.ovarianAnyAge;
    }
  }
  return pts;
}

// ── Ontario FHAT ───────────────────────────────────────────────────────────────────────────────
// El FHAT puntúa a los familiares, no al propio usuario.
function fhatForPerson(r: Relative): number {
  if (r.relation === 'self') return 0;
  const info = RELATIONS[r.relation];
  const breast = r.cancers.filter((c) => c.type === 'breast');
  const ovarian = r.cancers.filter((c) => c.type === 'ovarian');
  const role = info.fhat;
  let pts = 0;

  if (breast.length && ovarian.length) {
    // SUPUESTO: la fila "breast and ovarian cancer" sustituye a las dos filas de parentesco; la
    // edad de inicio de cada cáncer se suma igual.
    pts += role === 'mother' ? FHAT.breastAndOvarian.mother : role === 'sibling' ? FHAT.breastAndOvarian.sibling : FHAT.breastAndOvarian.other;
  } else if (breast.length) {
    pts += role === 'mother' || role === 'father' ? FHAT.breastRelative.parent : role === 'sibling' ? FHAT.breastRelative.sibling : FHAT.breastRelative.other;
  } else if (ovarian.length) {
    pts += role === 'mother' ? FHAT.ovarianRelative.mother : role === 'sibling' ? FHAT.ovarianRelative.sibling : FHAT.ovarianRelative.other;
  }
  if (breast.length && info.sex === 'M') pts += FHAT.breastRelative.maleAdd;
  for (const c of breast) {
    pts += FHAT.breastOnset[c.age] ?? 0;
    if (info.sex === 'F' && under50(c.age)) pts += FHAT.breastPremenopausal;
    if (c.bilateral) pts += FHAT.breastBilateralOrMultifocal;
  }
  for (const c of ovarian) pts += FHAT.ovarianOnset(c.age);
  for (const c of r.cancers) {
    if (c.type === 'prostate' && under50(c.age)) pts += FHAT.prostateUnder50;
    if (c.type === 'colorectal' && under50(c.age)) pts += FHAT.colonUnder50;
  }
  return pts;
}

// ── Manchester ─────────────────────────────────────────────────────────────────────────────────
function manchesterForPerson(r: Relative, selfSex?: 'female' | 'male'): [number, number] {
  let b1 = 0;
  let b2 = 0;
  const add = ([x, y]: [number, number]) => {
    b1 += x;
    b2 += y;
  };
  for (const c of r.cancers) {
    if (c.type === 'breast') {
      const pts = isMale(r, selfSex) ? MANCHESTER.maleBreast(c.age) : MANCHESTER.femaleBreast[c.age];
      add(pts);
      if (c.bilateral) add(pts); // la mama contralateral cuenta como otro cáncer
    } else if (c.type === 'ovarian') add(MANCHESTER.ovarian(c.age));
    else if (c.type === 'pancreatic') add(MANCHESTER.pancreatic);
    else if (c.type === 'prostate') add(MANCHESTER.prostate(c.age));
  }
  return [b1, b2];
}

const sumManchester = (people: Relative[], selfSex?: 'female' | 'male'): ManchesterScore => {
  let brca1 = 0;
  let brca2 = 0;
  for (const p of people) {
    const [x, y] = manchesterForPerson(p, selfSex);
    brca1 += x;
    brca2 += y;
  }
  return { brca1, brca2, combined: brca1 + brca2 };
};

// ── Lynch (Amsterdam II y Revised Bethesda, adaptados a lo que sabe el usuario) ─────────────────
const hasAny = (r: Relative, types: CancerEntry['type'][]) => r.cancers.some((c) => types.includes(c.type));
const earliestUnder50 = (r: Relative, types: CancerEntry['type'][]) => r.cancers.some((c) => types.includes(c.type) && under50(c.age));

function lynchForSide(people: Relative[]) {
  // Amsterdam II: ≥ 3 familiares con tumores del espectro, ≥ 2 generaciones seguidas, ≥ 1 antes de
  // los 50. SUPUESTO: no podemos comprobar "uno es de primer grado de los otros dos", ni excluir la
  // poliposis ni ver la anatomía patológica: por eso decimos "patrón tipo Amsterdam".
  const ams = people.filter((p) => hasAny(p, AMSTERDAM_TUMOURS));
  const gens = new Set(ams.map((p) => RELATIONS[p.relation].generation));
  const consecutive = [...gens].some((g) => gens.has(g + 1));
  const amsterdamLike = ams.length >= 3 && consecutive && ams.some((p) => earliestUnder50(p, AMSTERDAM_TUMOURS));

  // Revised Bethesda, criterios que dependen de la familia:
  // 1) colorrectal antes de los 50
  const crcUnder50 = people.some((p) => p.cancers.some((c) => c.type === 'colorectal' && under50(c.age)));
  // 2) colorrectal + otro tumor del espectro en la misma persona (sincrónico o metacrónico)
  const multiple = people.some(
    (p) => p.cancers.some((c) => c.type === 'colorectal') && p.cancers.filter((c) => BETHESDA_TUMOURS.includes(c.type)).length >= 2
  );
  // 4) colorrectal y un familiar de primer grado con tumor del espectro, uno antes de los 50
  const beth = people.filter((p) => hasAny(p, BETHESDA_TUMOURS));
  const pairUnder50 = beth.some((a) =>
    a.cancers.some((c) => c.type === 'colorectal') &&
    beth.some((b) => b !== a && areFirstDegree(a.relation, b.relation) && (earliestUnder50(a, BETHESDA_TUMOURS) || earliestUnder50(b, BETHESDA_TUMOURS)))
  );
  // 5) colorrectal con ≥ 2 familiares de 1.er o 2.º grado con tumores del espectro, a cualquier edad
  const three = beth.length >= 3 && beth.some((p) => p.cancers.some((c) => c.type === 'colorectal'));

  return { amsterdamLike, bethesdaLike: crcUnder50 || multiple || pairUnder50 || three };
}

// ── Textos ─────────────────────────────────────────────────────────────────────────────────────
const SIDE_TEXT: Record<Side, string> = { maternal: "your mother's side", paternal: "your father's side" };
const SIDE_LABEL = new Proxy(SIDE_TEXT, { get: (o, k: string) => t(o[k as Side]) }) as Record<Side, string>;

const ageText = (c: CancerEntry, possessive: string) =>
  c.age === 'unknown'
    ? t('age at diagnosis unknown')
    : c.age === 'u30'
      ? t('diagnosed under 30')
      : c.age === '60plus'
        ? t('diagnosed at 60 or older')
        : t('diagnosed in {possessive} {decade}s', { possessive, decade: AGE_LABEL[c.age].slice(0, 2) });

const personLine = (r: Relative) => {
  const self = r.relation === 'self';
  const who = self ? t('You') : t(RELATIONS[r.relation].label);
  const possessive = self ? 'your' : RELATIONS[r.relation].sex === 'M' ? 'his' : 'her';
  const parts = r.cancers.map((c) => `${t(CANCER_LABEL[c.type]).toLowerCase()}${c.bilateral ? t(' in both breasts') : ''}, ${ageText(c, possessive)}`);
  return `${who}: ${parts.join('; ')}.`;
};

const positive = (a: FamilyHistoryAnswers, id: TriageId) => a.triage[id] === 'yes';

// ── Motor ──────────────────────────────────────────────────────────────────────────────────────
export function assessFamilyHistory(answers: FamilyHistoryAnswers, opts: { selfSex?: 'female' | 'male' } = {}): GeneticsAssessment {
  const { selfSex } = opts;
  const people = answers.relatives.filter((r) => r.cancers.length > 0);
  const bySide = (side: Side) => people.filter((r) => inLineage(r, side));
  const ashkenazi = answers.ashkenazi;

  const patSide = (side: Side) =>
    bySide(side).reduce((s, r) => s + patForPerson(r, selfSex), 0) +
    (ashkenazi === side || ashkenazi === 'both' ? PAT.ashkenaziPerLineage : 0);
  const pat = { maternal: patSide('maternal'), paternal: patSide('paternal') };
  const patBest = Math.max(pat.maternal, pat.paternal);

  const fhatSide = (side: Side) => bySide(side).reduce((s, r) => s + fhatForPerson(r), 0);
  const fhat = { maternal: fhatSide('maternal'), paternal: fhatSide('paternal') };
  const fhatBest = Math.max(fhat.maternal, fhat.paternal);

  const msM = sumManchester(bySide('maternal'), selfSex);
  const msP = sumManchester(bySide('paternal'), selfSex);
  const msSide: Side = msP.combined > msM.combined ? 'paternal' : 'maternal';
  const ms = msSide === 'maternal' ? msM : msP;

  const lynchM = lynchForSide(bySide('maternal'));
  const lynchP = lynchForSide(bySide('paternal'));
  const lynch = { amsterdamLike: lynchM.amsterdamLike || lynchP.amsterdamLike, bethesdaLike: lynchM.bethesdaLike || lynchP.bethesdaLike };
  const lynchSide: Side | null = lynchM.amsterdamLike || lynchM.bethesdaLike ? 'maternal' : lynchP.amsterdamLike || lynchP.bethesdaLike ? 'paternal' : null;

  const genes = answers.knownGenes ?? [];
  const knownVariant = positive(answers, 'variant');
  const selfAffected = people.some((r) => r.relation === 'self');
  const unknownAges = people.some((r) => r.cancers.some((c) => c.age === 'unknown'));

  // Nivel: el más alto que alcance cualquiera de los criterios (son complementarios)
  const reasons: string[] = [];
  let level: GeneticRiskLevel = 'population';
  const raise = (to: GeneticRiskLevel, why: string) => {
    const order: GeneticRiskLevel[] = ['population', 'low', 'moderate', 'high'];
    if (order.indexOf(to) > order.indexOf(level)) level = to;
    reasons.push(why);
  };

  if (knownVariant) raise('high', t('A relative has a known inherited change (variant) linked to cancer.'));
  if (lynch.amsterdamLike) raise('high', t('Several bowel, womb or related cancers over two generations on {side}, one before 50 (Amsterdam II pattern).', { side: SIDE_LABEL[lynchSide ?? 'maternal'] }));
  if (ms.combined >= MANCHESTER.unaffectedRelativeThreshold)
    raise('high', t('Manchester score {score} on {side}: 20 or more is the level at which relatives without cancer are usually offered testing.', { score: ms.combined, side: SIDE_LABEL[msSide] }));
  else if (selfAffected && (ms.combined >= MANCHESTER.combinedThreshold || Math.max(ms.brca1, ms.brca2) >= MANCHESTER.singleGeneThreshold))
    raise('high', t('Manchester score {score} including your own diagnosis: at about a 10% chance of a BRCA1/2 variant, testing is usually offered.', { score: ms.combined }));
  else if (ms.combined >= MANCHESTER.combinedThreshold || Math.max(ms.brca1, ms.brca2) >= MANCHESTER.singleGeneThreshold)
    raise('moderate', t('Manchester score {score} on {side}: about a 10% chance that the affected relative carries a BRCA1/2 variant.', { score: ms.combined, side: SIDE_LABEL[msSide] }));
  if (patBest >= PAT.threshold) raise('moderate', t('Pedigree Assessment Tool score {score} (referral from {threshold}).', { score: patBest, threshold: PAT.threshold }));
  if (fhatBest >= FHAT.threshold) raise('moderate', t('Ontario family history score {score} (referral from {threshold}: about double the usual lifetime risk of breast cancer).', { score: fhatBest, threshold: FHAT.threshold }));
  if (lynch.bethesdaLike && !lynch.amsterdamLike) raise('moderate', t('A pattern of bowel or related cancers on {side} that meets the Bethesda criteria for checking Lynch syndrome.', { side: SIDE_LABEL[lynchSide ?? 'maternal'] }));
  if (level === 'population' && (people.length > 0 || ashkenazi === 'maternal' || ashkenazi === 'paternal' || ashkenazi === 'both'))
    raise('low', t('There is some cancer in your family, but not a pattern that points to an inherited cause.'));

  // Puntos para el médico
  const keyPoints: string[] = [];
  for (const g of genes) {
    keyPoints.push(
      g === 'other'
        ? t('A relative has a genetic variant linked to cancer: ask whether you should be tested for the same one, and bring the report if you can.')
        : t('A relative carries a {gene} variant: ask whether you should be tested for that same variant.', { gene: g === 'Lynch' ? t('Lynch syndrome (MLH1, MSH2, MSH6, PMS2 or EPCAM)') : g })
    );
  }
  if (knownVariant && genes.length === 0)
    keyPoints.push(t('A relative has a genetic variant linked to cancer: ask whether you should be tested for the same one, and bring the report if you can.'));
  for (const r of people) keyPoints.push(personLine(r));
  if (ashkenazi && ashkenazi !== 'no' && ashkenazi !== 'unsure')
    keyPoints.push(
      t('Ashkenazi Jewish ancestry on {side}: some BRCA1/2 variants are more common in this ancestry.', { side: ashkenazi === 'both' ? t('both sides') : SIDE_LABEL[ashkenazi] })
    );
  if (lynch.amsterdamLike || lynch.bethesdaLike)
    keyPoints.push(t('Ask whether a bowel tumour from the family can be tested for Lynch syndrome (MSI or immunohistochemistry), or whether you should see a genetics service.'));
  if (people.length) {
    keyPoints.push(
      t('Scores on the worse side: Manchester {ms} (BRCA1 {b1}, BRCA2 {b2}), Pedigree Assessment Tool {pat}, Ontario FHAT {fhat}.', { ms: ms.combined, b1: ms.brca1, b2: ms.brca2, pat: patBest, fhat: fhatBest })
    );
  }
  if (unknownAges) keyPoints.push(t('Some ages at diagnosis are unknown. Asking relatives before the appointment makes the assessment more accurate.'));

  // Corazón (no cambia el nivel de cáncer; va en su propia tarjeta)
  const heartPoints: string[] = [];
  if (positive(answers, 'heart_early')) {
    const who = (answers.heartRelatives ?? []).map((id) => t(RELATIONS[id].short).toLowerCase());
    heartPoints.push(
      who.length
        ? t('Your {who} had heart disease or a stroke young (men before 55, women before 65). This counts as a risk-enhancing factor: ask for a cholesterol test that includes Lp(a).', { who: who.join(', ') })
        : t('A parent, brother, sister or child had heart disease or a stroke young (men before 55, women before 65). This counts as a risk-enhancing factor: ask for a cholesterol test that includes Lp(a).')
    );
  }
  if (positive(answers, 'cholesterol'))
    heartPoints.push(t('Very high cholesterol or familial hypercholesterolaemia runs in your close family: ask your doctor for a full cholesterol test (and whether it could be familial).'));
  if (positive(answers, 'sudden_death'))
    heartPoints.push(t('A relative died suddenly at a young age without a clear cause: tell your doctor, some heart conditions run in families and can be checked.'));

  return {
    level,
    reasons,
    keyPoints,
    pat: { ...pat, best: patBest, threshold: PAT.threshold, met: patBest >= PAT.threshold },
    fhat: { ...fhat, best: fhatBest, threshold: FHAT.threshold, met: fhatBest >= FHAT.threshold },
    manchester: { maternal: msM, paternal: msP, best: ms, side: msSide },
    lynch,
    heart: { flagged: heartPoints.length > 0, points: heartPoints },
    unknownAges,
  };
}

// El Nivel 1 dice si hace falta el Nivel 2: alguna respuesta positiva de cáncer
export const needsFamilyDetail = (a: FamilyHistoryAnswers) =>
  (['breast', 'ovarian', 'bowel', 'pancreas_prostate', 'self_cancer'] as TriageId[]).some((id) => a.triage[id] === 'yes');

// Qué tipos de cáncer ofrecer al elegir los de cada familiar, según el Nivel 1
export function cancerTypesFor(a: FamilyHistoryAnswers, isSelf: boolean, sex: 'F' | 'M' | 'self', selfSex?: 'female' | 'male') {
  const male = sex === 'M' || (sex === 'self' && selfSex === 'male');
  const female = sex === 'F' || (sex === 'self' && selfSex === 'female');
  const out: CancerEntry['type'][] = [];
  const yes = (id: TriageId) => a.triage[id] === 'yes' || isSelf;
  if (yes('breast')) out.push('breast');
  if (yes('ovarian') && !male) out.push('ovarian');
  if (yes('bowel')) {
    out.push('colorectal');
    if (!male) out.push('endometrial');
    out.push('small_bowel', 'urinary', 'stomach');
  }
  if (yes('pancreas_prostate')) {
    out.push('pancreatic');
    if (!female) out.push('prostate');
  }
  out.push('other');
  return [...new Set(out)];
}

export const LEVEL_TEXT: Record<GeneticRiskLevel, { title: string; body: string }> = {
  population: {
    title: t('Like most people'),
    body: t('Your answers do not point to an inherited cancer risk. Keep up the usual screening for your age.'),
  },
  low: {
    title: t('Some cancer in the family, no inherited pattern'),
    body: t('Cancer is common, and many families have a case or two. Your answers do not meet the criteria for a genetics referral today. If something new happens in your family, update your answers.'),
  },
  moderate: {
    title: t('Worth talking to a professional'),
    body: t('Your family history meets at least one of the criteria doctors use to consider a referral to genetic counselling.'),
  },
  high: {
    title: t('A genetic counselling appointment is recommended'),
    body: t('Your family history meets the criteria at which genetic counselling, and often a genetic test, is usually offered.'),
  },
};

export const REFERRAL_INTRO = t(
  'Based on your answers and on clinical prevention criteria, we strongly recommend talking to your GP or a genetic counsellor. When you go, remind them of these key points:',
);
