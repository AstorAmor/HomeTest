import { describe, expect, it } from 'vitest';
import { assessFamilyHistory, cancerTypesFor, needsFamilyDetail } from '@/logic/genetics';
import { FamilyHistoryAnswers, Relative } from '@/types/familyHistory';

// Familias representativas para "Know your roots". Los puntos esperados salen a mano de las tablas
// de src/data/genetics/scoring.ts (USPSTF Appendix C1 / NHS GeNotes).

const rel = (relation: Relative['relation'], ...cancers: Relative['cancers']): Relative => ({ id: relation, relation, cancers });
const answers = (a: Partial<FamilyHistoryAnswers>): FamilyHistoryAnswers => ({ triage: {}, relatives: [], ...a });

describe('Know your roots: motor de antecedentes familiares', () => {
  it('sin antecedentes: riesgo poblacional y todo a cero', () => {
    const r = assessFamilyHistory(answers({ triage: { breast: 'no', ovarian: 'no', bowel: 'no', pancreas_prostate: 'no' } }));
    expect(r.level).toBe('population');
    expect(r.pat.best).toBe(0);
    expect(r.fhat.best).toBe(0);
    expect(r.manchester.best.combined).toBe(0);
    expect(r.keyPoints).toEqual([]);
  });

  it('madre con cáncer de mama a los 38: FHAT 10 (4 + 4 + 2) → hablar con un profesional', () => {
    const r = assessFamilyHistory(answers({ triage: { breast: 'yes' }, relatives: [rel('mother', { type: 'breast', age: '30s' })] }));
    expect(r.pat.maternal).toBe(4);
    expect(r.fhat.maternal).toBe(10);
    expect(r.manchester.maternal).toEqual({ brca1: 4, brca2: 4, combined: 8 });
    expect(r.level).toBe('moderate');
    expect(r.reasons.join(' ')).toMatch(/Ontario/);
    expect(r.keyPoints[0]).toBe('Your mother: breast cancer, diagnosed in her 30s.');
  });

  it('madre con cáncer de mama a los 62: algo de cáncer pero sin patrón → bajo', () => {
    const r = assessFamilyHistory(answers({ triage: { breast: 'yes' }, relatives: [rel('mother', { type: 'breast', age: '60plus' })] }));
    expect(r.pat.maternal).toBe(3);
    expect(r.fhat.maternal).toBe(4);
    expect(r.level).toBe('low');
  });

  it('madre y tía materna con cáncer de ovario: Manchester 23 → alto', () => {
    const r = assessFamilyHistory(
      answers({
        triage: { ovarian: 'yes' },
        relatives: [rel('mother', { type: 'ovarian', age: '50s' }), rel('aunt_m', { type: 'ovarian', age: '60plus' })],
      })
    );
    expect(r.pat.maternal).toBe(10); // 5 + 5
    expect(r.fhat.maternal).toBe(16); // 7 + 4 + 3 + 2
    expect(r.manchester.maternal).toEqual({ brca1: 13, brca2: 10, combined: 23 }); // 8+5, 5+5
    expect(r.manchester.paternal.combined).toBe(0);
    expect(r.level).toBe('high');
  });

  it('familia tipo Lynch por la rama paterna (3 personas, 2 generaciones, uno antes de 50) → alto', () => {
    const r = assessFamilyHistory(
      answers({
        triage: { bowel: 'yes' },
        relatives: [
          rel('father', { type: 'colorectal', age: '40s' }),
          rel('grandfather_p', { type: 'colorectal', age: '60plus' }),
          rel('aunt_p', { type: 'endometrial', age: '50s' }),
        ],
      })
    );
    expect(r.lynch.amsterdamLike).toBe(true);
    expect(r.level).toBe('high');
    expect(r.keyPoints.join(' ')).toMatch(/Lynch syndrome/);
  });

  it('un solo familiar con cáncer colorrectal antes de los 50 → Bethesda, moderado', () => {
    const r = assessFamilyHistory(answers({ triage: { bowel: 'yes' }, relatives: [rel('uncle_m', { type: 'colorectal', age: '40s' })] }));
    expect(r.lynch).toEqual({ amsterdamLike: false, bethesdaLike: true });
    expect(r.level).toBe('moderate');
  });

  it('ascendencia asquenazí sola: 4 puntos PAT, bajo; con una abuela con cáncer de mama antes de 50 llega a 8', () => {
    const solo = assessFamilyHistory(answers({ ashkenazi: 'maternal' }));
    expect(solo.pat.maternal).toBe(4);
    expect(solo.level).toBe('low');
    const withGran = assessFamilyHistory(
      answers({ ashkenazi: 'maternal', triage: { breast: 'yes' }, relatives: [rel('grandmother_m', { type: 'breast', age: '40s' })] })
    );
    expect(withGran.pat.maternal).toBe(8);
    expect(withGran.pat.paternal).toBe(0);
    expect(withGran.level).toBe('moderate');
    expect(withGran.keyPoints.join(' ')).toMatch(/Ashkenazi/);
  });

  it('padre con cáncer de mama: 8 puntos PAT y 8 de BRCA2 en Manchester', () => {
    const r = assessFamilyHistory(answers({ triage: { breast: 'yes' }, relatives: [rel('father', { type: 'breast', age: '50s' })] }));
    expect(r.pat.paternal).toBe(8);
    expect(r.manchester.paternal).toEqual({ brca1: 5, brca2: 8, combined: 13 });
    expect(r.fhat.paternal).toBe(6); // progenitor 4 + varón 2
    expect(r.level).toBe('moderate');
  });

  it('hermana con cáncer en las dos mamas antes de 50: cuenta doble en PAT y en ambas ramas', () => {
    const r = assessFamilyHistory(answers({ triage: { breast: 'yes' }, relatives: [rel('sister', { type: 'breast', age: '40s', bilateral: true })] }));
    expect(r.pat.maternal).toBe(8);
    expect(r.pat.paternal).toBe(8);
    expect(r.fhat.maternal).toBe(3 + 2 + 2 + 3);
    expect(r.level).toBe('moderate');
  });

  it('variante conocida en la familia → alto, con el gen en los puntos clave', () => {
    const r = assessFamilyHistory(answers({ triage: { variant: 'yes' }, knownGenes: ['BRCA2'] }));
    expect(r.level).toBe('high');
    expect(r.keyPoints[0]).toMatch(/BRCA2 variant/);
  });

  it('el propio usuario con cáncer de mama a los 35 y su madre a los 45: umbral de Manchester para afectados', () => {
    const r = assessFamilyHistory(
      answers({
        triage: { breast: 'yes', self_cancer: 'yes' },
        relatives: [rel('self', { type: 'breast', age: '30s' }), rel('mother', { type: 'breast', age: '40s' })],
      }),
      { selfSex: 'female' }
    );
    expect(r.manchester.maternal.combined).toBe(8 + 6);
    expect(r.level).toBe('moderate'); // 14 < 15; PAT 8 sí deriva
    expect(r.keyPoints).toContain('You: breast cancer, diagnosed in your 30s.');
  });

  it('edad desconocida: puntúa lo mínimo y lo avisa', () => {
    const r = assessFamilyHistory(answers({ triage: { breast: 'yes' }, relatives: [rel('aunt_p', { type: 'breast', age: 'unknown' })] }));
    expect(r.pat.paternal).toBe(3);
    expect(r.manchester.paternal.combined).toBe(2);
    expect(r.unknownAges).toBe(true);
    expect(r.keyPoints.at(-1)).toMatch(/ages at diagnosis are unknown/);
  });

  it('corazón: enfermedad precoz en un familiar de primer grado va aparte y no cambia el nivel de cáncer', () => {
    const r = assessFamilyHistory(answers({ triage: { heart_early: 'yes', breast: 'no' }, heartRelatives: ['father'] }));
    expect(r.level).toBe('population');
    expect(r.heart.flagged).toBe(true);
    expect(r.heart.points[0]).toMatch(/Your father.*Lp\(a\)/);
  });

  it('el Nivel 2 solo se abre si hay algo positivo de cáncer', () => {
    expect(needsFamilyDetail(answers({ triage: { breast: 'no', heart_early: 'yes' } }))).toBe(false);
    expect(needsFamilyDetail(answers({ triage: { ovarian: 'yes' } }))).toBe(true);
  });

  it('solo ofrece tipos de cáncer posibles para cada familiar', () => {
    const a = answers({ triage: { ovarian: 'yes', pancreas_prostate: 'yes' } });
    expect(cancerTypesFor(a, false, 'M')).toEqual(['pancreatic', 'prostate', 'other']);
    expect(cancerTypesFor(a, false, 'F')).toEqual(['ovarian', 'pancreatic', 'other']);
  });
});
