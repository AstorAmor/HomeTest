import fs from 'node:fs';
import path from 'node:path';
import {
  buildCase,
  CASE_PROBLEMS,
  CaseInput,
  expandPersona,
  NUDGE_RULES,
  Persona,
  simulatePersona,
  SimulationDay,
} from '@/logic/nudges';

// npm run simulate                      → todos los usuarios de simulation/personas, empezando hoy
// npm run simulate -- --persona gloria  → solo los que contengan "gloria" en el id o el archivo
// npm run simulate -- --start 2026-11-01  → con otra fecha como "día 0"
// npm run simulate -- --all             → enseña también los avisos que no tocaban (y por qué)
// npm run simulate -- --export          → además guarda cada usuario con fechas reales (JSON)
// npm run simulate -- --case bp_high --days 56 --sex female --age 55 --severity moderate --logging daily
//                                       → un caso inventado al momento (como Developer mode → Build a case);
//                                         con --save se guarda en simulation/personas para siempre
// Informe: simulation/output/report.md (no se sube a GitHub; se regenera cuando quieras).

const STATUS_ES: Record<string, string> = {
  send: 'enviado',
  muted: 'silenciado',
  cooldown: 'en espera',
  daily_limit: 'límite diario',
  not_due: 'no toca',
  missing: 'no existe',
};

function arg(argv: string[], name: string) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

const localMidnight = (iso?: string) => {
  const d = iso ? new Date(`${iso}T00:00:00`) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const cell = (s: string) => s.replace(/\|/g, '/');

function dayRow(d: SimulationDay, showAll: boolean) {
  const sent = d.decisions.filter((x) => x.status === 'send');
  const held = d.decisions.filter((x) => ['muted', 'cooldown', 'daily_limit'].includes(x.status));
  const notDue = showAll ? d.decisions.filter((x) => x.status === 'not_due') : [];
  if (!sent.length && !held.length && !d.events.length && !notDue.length) return null;
  return `| ${d.day} | ${d.date} | ${cell(d.events.join(', ') || '—')} | ${cell(
    sent.map((x) => `**${x.label}**: ${x.title} _(${x.reason})_`).join('<br>') || '—'
  )} | ${cell(
    [...held, ...notDue].map((x) => `${x.label} — ${STATUS_ES[x.status]}: ${x.reason}`).join('<br>') || '—'
  )} |`;
}

// La app no puede leer carpetas: este índice le dice qué JSON hay. Se rehace en cada ejecución,
// así basta con añadir o quitar archivos de simulation/personas y lanzar npm run simulate.
function writeIndex(dir: string) {
  const all = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const body = [
    '// Generado por npm run simulate: no editar a mano (añade o cambia los JSON de esta carpeta).',
    "import type { Persona } from '@/logic/nudges';",
    ...all.map((f, i) => `import p${i} from './${f}';`),
    '',
    `export const PERSONAS = [${all.map((_, i) => `p${i}`).join(', ')}] as unknown as Persona[];`,
    '',
  ].join('\n');
  const file = path.join(dir, 'index.ts');
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== body) fs.writeFileSync(file, body);
}

export async function main(argv: string[], root: string): Promise<number> {
  const dir = path.join(root, 'simulation', 'personas');
  writeIndex(dir);
  const filter = arg(argv, 'persona');
  const start = localMidnight(arg(argv, 'start'));
  const showAll = argv.includes('--all');
  const exportJson = argv.includes('--export');

  let personas: Persona[];
  const problem = arg(argv, 'case');
  if (problem) {
    if (!CASE_PROBLEMS.some((p) => p.id === problem)) {
      console.error(`Caso desconocido "${problem}". Disponibles: ${CASE_PROBLEMS.map((p) => p.id).join(', ')}`);
      return 1;
    }
    const input: CaseInput = {
      problem: problem as CaseInput['problem'],
      sex: (arg(argv, 'sex') as CaseInput['sex']) ?? 'female',
      age: Number(arg(argv, 'age') ?? 45),
      severity: (arg(argv, 'severity') as CaseInput['severity']) ?? 'moderate',
      days: Number(arg(argv, 'days') ?? 28),
      logging: (arg(argv, 'logging') as CaseInput['logging']) ?? 'daily',
      daysAhead: Number(arg(argv, 'ahead') ?? 14),
    };
    const persona = buildCase(input);
    if (argv.includes('--save')) {
      const n = fs.readdirSync(dir).filter((f) => /^\d+-.*\.json$/.test(f)).length + 1;
      const file = path.join(dir, `${String(n).padStart(2, '0')}-${persona.id}.json`);
      fs.writeFileSync(file, JSON.stringify(persona, null, 2) + '\n');
      writeIndex(dir);
      console.log(`Guardado: ${file} (añade "expect" si quieres que los tests lo comprueben)`);
    }
    personas = [persona];
  } else {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .filter((f) => !filter || f.toLowerCase().includes(filter.toLowerCase()))
      .sort();
    if (!files.length) {
      console.error(`No hay usuarios en ${dir}${filter ? ` que contengan "${filter}"` : ''}`);
      return 1;
    }
    personas = files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Persona);
  }

  const outDir = path.join(root, 'simulation', 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const startIso = start.toISOString().slice(0, 10);
  const lines = [
    `# Simulación de avisos — día 0 = ${startIso}`,
    '',
    `Reglas: ${NUDGE_RULES.map((r) => `${r.label} (cada ${r.cooldownDays} d como mucho)`).join(' · ')}.`,
    'Los avisos se evalúan cada tarde a las 20:00, como haría la app.',
    '',
  ];
  let failures = 0;

  for (const persona of personas) {
    const { days, expectations } = simulatePersona(persona, start);
    const failed = expectations.filter((e) => !e.pass);
    failures += failed.length;
    const sends = days.flatMap((d) => d.decisions.filter((x) => x.status === 'send')).length;

    console.log(
      `${failed.length ? '✗' : '✓'} ${persona.name.padEnd(8)} ${persona.id.padEnd(26)} ` +
        `${expectations.length - failed.length}/${expectations.length} comprobaciones · ${sends} avisos enviados`
    );
    for (const f of failed) {
      console.log(`    día ${f.day}: "${f.nudge}" esperado ${STATUS_ES[f.status]}, sale ${STATUS_ES[f.actual]}`);
    }
    // Un caso suelto: su línea de tiempo también en la consola
    if (problem) {
      for (const d of days) {
        for (const x of d.decisions.filter((dec) => dec.status === 'send')) {
          console.log(`    día ${String(d.day).padStart(4)} ${d.date}  ${x.title}  (${x.reason})`);
        }
      }
    }

    lines.push(`## ${persona.name} · \`${persona.id}\``, '', persona.summary, '');
    if (persona.tests) lines.push(`**Qué prueba:** ${persona.tests}`, '');
    if (expectations.length) {
      lines.push('**Comprobaciones**', '');
      for (const e of expectations) {
        lines.push(
          `- ${e.pass ? '✅' : '❌'} Día ${e.day}: ${e.nudge} → esperado _${STATUS_ES[e.status]}_, sale _${STATUS_ES[e.actual]}_${e.note ? ` (${e.note})` : ''}`
        );
      }
      lines.push('');
    }
    lines.push('| Día | Fecha | Registra | Avisos enviados | Retenidos o no tocan |', '|---|---|---|---|---|');
    for (const d of days) {
      const row = dayRow(d, showAll);
      if (row) lines.push(row);
    }
    lines.push('');

    if (exportJson) {
      const x = expandPersona(persona, start);
      const { eventsByDay: _omit, ...data } = x;
      fs.writeFileSync(
        path.join(outDir, `${persona.id}.expanded.json`),
        JSON.stringify({ persona: persona.id, day0: startIso, ...data }, null, 2)
      );
    }
  }

  const report = path.join(outDir, 'report.md');
  fs.writeFileSync(report, lines.join('\n'));
  console.log(`\nInforme: ${report}`);
  if (exportJson) console.log(`Datos con fechas reales: ${outDir}\\<id>.expanded.json`);
  if (failures) console.log(`\n${failures} comprobación(es) no cumplida(s).`);
  return failures ? 1 : 0;
}
