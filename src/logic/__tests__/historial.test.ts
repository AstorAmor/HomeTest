import { describe, expect, it } from 'vitest';
import {
  cardContent,
  catalogAllergy,
  demoHistorial,
  doseDate,
  emergencyMissing,
  emergencyQrText,
  emptyCard,
  emptyHistorial,
  hasAllergy,
  historialSummary,
  lockBackground,
  LOCK_QR_MAX_MODULES,
  lockQr,
  normalizeHistorial,
  toggleAllergy,
  toggleNotice,
  vaccineGroups,
  wrapLines,
} from '@/logic/historial';
import { qrCells, qrShape } from '@/logic/qr';

describe('Historial: normalizar lo guardado', () => {
  it('se queda solo con lo que tiene sentido', () => {
    const h = normalizeHistorial(
      {
        allergies: [
          { name: 'Penicillin', group: 'drugs' },
          { name: ' penicillin ', group: 'drugs' }, // repetida
          { name: 'Cebolla', group: 'raro' }, // grupo desconocido → otras, escrita por la persona
          { name: '', group: 'food' },
          'basura',
        ],
        bloodGroup: 'Z+',
        vaccines: [
          { id: 'v1', name: 'COVID-19', month: 4, year: 2021 },
          { id: 'v2', name: 'Rabia', month: 13, year: 2021 }, // mes imposible
          { id: 'v3', name: 'Yellow fever', month: 3, year: null }, // mes sin año: fuera el mes
          { id: 'v4', name: 'Hepatitis B', year: 1800 }, // año imposible
          { name: '' },
        ],
        surgeries: [{ id: 'h1', name: '  Apendicectomía ', year: 2009 }, { name: '' }],
        conditions: 'no es una lista',
        card: { fullName: '  Ana García  ', phone: 600000000, contact: 'Luis' },
      },
      2026,
    );
    expect(h.allergies).toEqual([
      { name: 'Penicillin', group: 'drugs' },
      { name: 'Cebolla', group: 'other', custom: true },
    ]);
    expect(h.bloodGroup).toBeNull();
    expect(h.vaccines).toEqual([
      { id: 'v1', name: 'COVID-19', month: 4, year: 2021 },
      { id: 'v2', name: 'Rabia', custom: true, month: null, year: 2021 },
      { id: 'v3', name: 'Yellow fever', month: null, year: null },
      { id: 'v4', name: 'Hepatitis B', month: null, year: null },
    ]);
    // Las dos listas de antes (cirugías e historia clínica) pasan a eventos con categoría
    expect(h.events).toEqual([{ id: 'h1', cat: 'surgery', name: 'Apendicectomía', year: 2009 }]);
    expect(h.card).toEqual({ ...emptyCard(), fullName: 'Ana García', contact: 'Luis' });
  });

  it('los eventos: categoría desconocida → «otros»; la historia clínica de antes también', () => {
    const h = normalizeHistorial(
      {
        surgeries: [{ id: 'h1', name: 'Rodilla', year: 2010 }],
        conditions: [{ id: 'h2', name: 'Asma', year: 1999 }],
      },
      2026,
    );
    expect(h.events.map((e) => [e.name, e.cat])).toEqual([
      ['Rodilla', 'surgery'],
      ['Asma', 'other'],
    ]);
    // Con la lista nueva, las viejas ya no cuentan
    const n = normalizeHistorial(
      {
        events: [
          { id: 'e1', cat: 'hospital', name: 'Neumonía', year: 2020 },
          { id: 'e2', cat: 'raro', name: 'Algo', year: 2030 }, // año futuro: sin año
        ],
        surgeries: [{ id: 'h1', name: 'Rodilla' }],
      },
      2026,
    );
    expect(n.events).toEqual([
      { id: 'e1', cat: 'hospital', name: 'Neumonía', year: 2020 },
      { id: 'e2', cat: 'other', name: 'Algo', year: null },
    ]);
  });

  it('la tarjeta: qué se ve, avisos de la lista o escritos, sin repetir', () => {
    const c = normalizeHistorial({
      card: {
        address: ' Calle Mayor 1, Madrid ',
        show: { address: false, otherAllergies: true, name: 'sí' }, // lo que no es sí/no se ignora
        notices: [{ name: 'Diabetes' }, { name: 'diabetes' }, { name: 'Marcapasos nuevo' }, { name: '' }],
      },
    }).card;
    expect(c.address).toBe('Calle Mayor 1, Madrid');
    expect(c.show).toEqual({ name: true, blood: true, drugAllergies: true, contact: true, notices: true, otherAllergies: true, address: false });
    expect(c.notices).toEqual([{ name: 'Diabetes' }, { name: 'Marcapasos nuevo', custom: true }]);
    // Por defecto, las alergias a alimentos no salen (solo las de medicamentos)
    expect(emptyCard().show.otherAllergies).toBe(false);
  });

  it('tocar un aviso lo pone o lo quita; como mucho 8', () => {
    let c = toggleNotice(emptyCard(), "I'm pregnant");
    expect(c.notices).toEqual([{ name: "I'm pregnant" }]);
    c = toggleNotice(c, 'Llevo una prótesis de cadera');
    expect(c.notices[1]).toEqual({ name: 'Llevo una prótesis de cadera', custom: true });
    c = toggleNotice(c, "i'm PREGNANT");
    expect(c.notices.map((n) => n.name)).toEqual(['Llevo una prótesis de cadera']);
    expect(toggleNotice(c, '   ')).toBe(c);
    for (let i = 0; i < 10; i++) c = toggleNotice(c, `Aviso ${i}`);
    expect(c.notices).toHaveLength(8);
  });

  it('sin nada guardado, vacío', () => {
    expect(normalizeHistorial(undefined)).toEqual(emptyHistorial());
    expect(normalizeHistorial({ bloodGroup: 'AB-' }).bloodGroup).toBe('AB-');
  });

  it('tocar una alergia la pone o la quita', () => {
    let h = toggleAllergy(emptyHistorial(), 'Latex', 'other');
    expect(h.allergies).toEqual([{ name: 'Latex', group: 'other' }]);
    h = toggleAllergy(h, 'Nueces de Brasil', 'food');
    expect(h.allergies[1]).toEqual({ name: 'Nueces de Brasil', group: 'food', custom: true });
    h = toggleAllergy(h, 'latex', 'other');
    expect(h.allergies.map((a) => a.name)).toEqual(['Nueces de Brasil']);
  });

  it('lo escrito que ya está en la lista es el de la lista, en su grupo (sin tildes ni mayúsculas)', () => {
    // El fundador escribió «Metamizol» con «Metamizol (Nolotil)» en la lista: salían dos
    expect(catalogAllergy('  METAMIZOLE ')).toEqual({ name: 'Metamizole', group: 'drugs' });
    expect(catalogAllergy('Látex')).toEqual({ name: 'Latex', group: 'other' });
    expect(catalogAllergy('Ibuprofen')).toBeNull(); // un trozo no basta
    let h = toggleAllergy(emptyHistorial(), 'látex', 'drugs'); // el grupo elegido no cuenta
    expect(h.allergies).toEqual([{ name: 'Latex', group: 'other' }]);
    expect(hasAllergy(h, 'LATEX')).toBe(true);
    h = toggleAllergy(h, 'Latex', 'other');
    expect(h.allergies).toEqual([]);
    // Lo ya guardado como escrito se arregla al leerlo, sin repetir
    const n = normalizeHistorial({
      allergies: [
        { name: 'Metamizole', group: 'drugs' },
        { name: 'metamizole', group: 'other', custom: true },
        { name: 'Peanut', group: 'other', custom: true },
      ],
    });
    expect(n.allergies).toEqual([
      { name: 'Metamizole', group: 'drugs' },
      { name: 'Peanut', group: 'food' },
    ]);
  });
});

describe('Historial: vacunas', () => {
  it('por vacuna en el orden en que se añadieron; las dosis por fecha y sin fecha al final', () => {
    const g = vaccineGroups([
      { id: 'a', name: 'COVID-19', month: 12, year: 2021 },
      { id: 'b', name: 'Flu vaccine', month: 10, year: 2026 },
      { id: 'c', name: 'COVID-19', month: null, year: null },
      { id: 'd', name: 'COVID-19', month: 4, year: 2021 },
      { id: 'e', name: 'COVID-19', month: null, year: 2021 },
    ]);
    expect(g.map((x) => x.name)).toEqual(['COVID-19', 'Flu vaccine']);
    expect(g[0].doses.map((d) => d.id)).toEqual(['e', 'd', 'a', 'c']);
  });

  it('la fecha, con mes, solo año o sin fecha', () => {
    expect(doseDate({ month: 3, year: 2019 })).toBe('March 2019');
    expect(doseDate({ month: 3, year: 2019 }, true)).toBe('Mar 2019');
    expect(doseDate({ month: null, year: 2004 })).toBe('2004');
    expect(doseDate({ month: null, year: null })).toBe('No date');
  });

  it('el resumen de Mis datos', () => {
    const s = historialSummary(demoHistorial());
    expect(s.allergies).toBe('Penicillin · Shellfish');
    expect(s.bloodGroup).toBe('A+');
    expect(s.vaccineCount).toBe(5);
    expect(s.vaccines).toBe('7 doses. Last: flu vaccine, October 2026');
    expect(historialSummary(emptyHistorial()).vaccines).toBe('Add them from the list');
    expect(s.events).toBe('3 events');
    expect(s.eventNames).toBe('Apendicectomía · 2009, Asma leve · 1998, Fractura de muñeca · 2015');
    expect(historialSummary(emptyHistorial()).events).toBe('None added');
  });
});

describe('Tarjeta de emergencia', () => {
  it('el QR: texto plano (se lee sin internet) con nombre, grupo, alergias a medicamentos y a quién llamar', () => {
    expect(emergencyQrText(demoHistorial())).toBe(
      [
        'EMERGENCY CARD · KUOVA HEALTH',
        'Name: Ana García López',
        'Blood group: A+',
        'Drug allergies: Penicillin', // el marisco no: solo las de medicamentos
        'Important: Asthma',
        'In an emergency, call: Luis (pareja) · 600 000 000',
      ].join('\n'),
    );
  });

  it('lo que se oculta no sale, ni en la tarjeta ni en el QR; la dirección nunca en el fondo de pantalla', () => {
    const d = demoHistorial();
    const h = {
      ...d,
      card: { ...d.card, address: 'Calle Mayor 1, Madrid', show: { ...d.card.show, blood: false, otherAllergies: true } },
    };
    const k = cardContent(h);
    expect(k.blood).toBeNull();
    expect(k.sections.map((x) => x.field)).toEqual(['drugAllergies', 'notices', 'otherAllergies', 'contact', 'address']);
    expect(k.sections.find((x) => x.field === 'otherAllergies')?.text).toBe('Shellfish');
    expect(emergencyQrText(h)).not.toContain('Blood group');
    expect(emergencyQrText(h)).toContain('Address: Calle Mayor 1, Madrid');
    expect(cardContent(h, { lock: true }).sections.map((x) => x.field)).not.toContain('address');
    expect(emergencyQrText(h, { lock: true })).not.toContain('Calle Mayor');
    // Ocultar el nombre: ni sale ni se pide
    const sinNombre = { ...emptyHistorial(), card: { ...emptyCard(), show: { ...emptyCard().show, name: false } } };
    expect(cardContent(sinNombre).name).toBeNull();
    expect(emergencyMissing(sinNombre)).not.toContain('your name');
    // Un opcional vacío no sale; uno recomendado vacío sale «Sin indicar», salvo el contacto: sin
    // teléfono, nada sobre él (fundador, 2026-11-05)
    expect(cardContent(emptyHistorial()).sections.map((x) => x.field)).toEqual(['drugAllergies']);
  });

  it('lo que falta se dice «sin indicar», nunca «ninguna»; sin contacto, nada', () => {
    const txt = emergencyQrText(emptyHistorial());
    expect(txt).toContain('Name: Not stated');
    expect(txt).toContain('Blood group: Not stated');
    expect(txt).toContain('Drug allergies: Not stated');
    expect(txt).not.toContain('In an emergency');
    expect(emergencyQrText({ ...emptyHistorial(), card: { ...emptyCard(), contact: 'Luis' } })).not.toContain('Luis'); // de quién es, sin teléfono: tampoco
    expect(emergencyMissing(emptyHistorial())).toEqual(['your name', 'your blood group']);
    expect(emergencyMissing(demoHistorial())).toEqual([]);
    const o = { ...emptyHistorial(), bloodGroup: 'O-' as const, card: { ...emptyCard(), fullName: 'X', phone: '112' } };
    expect(emergencyQrText(o)).toContain('Blood group: O−');
    expect(emergencyQrText(o)).toContain('In an emergency, call: 112');
  });

  it('las líneas de la tarjeta no cortan palabras y acaban en «…» si no caben', () => {
    expect(wrapLines('Penicilina, Amoxicilina, Ibuprofeno y otros AINE', 24, 3)).toEqual(['Penicilina, Amoxicilina,', 'Ibuprofeno y otros AINE']);
    expect(wrapLines('uno dos tres cuatro cinco', 9, 2)).toEqual(['uno dos', 'tres…']);
    expect(wrapLines('', 10, 2)).toEqual([]);
  });

  it('el QR: un cuadrado con sus marcas de las esquinas', () => {
    const q = qrShape(emergencyQrText(demoHistorial()));
    expect((q.size - 21) % 4).toBe(0); // versiones de QR: 21, 25, 29…
    expect(q.size).toBeLessThanOrEqual(81); // nivel H: más módulos que con el M de antes
    // La marca de arriba a la izquierda: la primera fila empieza con 7 módulos oscuros
    expect(q.path.startsWith('M0 0h7v1h-7z')).toBe(true);
    // Mismo texto, mismo dibujo; otro texto, otro
    expect(qrShape(emergencyQrText(demoHistorial())).path).toBe(q.path);
    expect(qrShape('otra cosa').path).not.toBe(q.path);
    expect(q.hole).toBeNull();
  });

  it('el QR de la pantalla de bloqueo: más corto, para que quepa en uno más pequeño (2026-11-09)', () => {
    const q = lockQr(demoHistorial());
    expect(q.text).toBe(
      [
        'EMERGENCY',
        'Ana García López', // sin «Name:»
        'Blood group: A+',
        'Drug allergies: Penicillin',
        'Important: Asthma',
        'Who to call: Luis (pareja) · 600 000 000',
      ].join('\n'),
    );
    expect(q.text).toBe(emergencyQrText(demoHistorial(), { lock: true }));
    expect(q.modules).toBeLessThanOrEqual(65); // versión 12: entra en 380 px
    expect(q.cut).toEqual([]);
    // Sin nombre escrito: se dice, con su etiqueta
    expect(lockQr(emptyHistorial()).text.split('\n')[1]).toBe('Name: Not stated');
  });

  it('el QR de bloqueo con mucho texto: crece antes de recortar, y nunca pierde el teléfono', () => {
    const d = demoHistorial();
    const card = (over: object) => ({ ...d.card, ...over, show: { ...d.card.show, otherAllergies: true } });
    // Una tarjeta larga pero normal: no se recorta nada (el QR crece)
    const largo = {
      ...d,
      allergies: [...['Penicillin', 'Amoxicillin', 'Ibuprofen and other NSAIDs', 'Metamizole'].map((name) => ({ name, group: 'drugs' as const })), { name: 'Shellfish', group: 'food' as const }],
      card: card({ fullName: 'María del Carmen Fernández-Villaverde Ruiz', contact: 'Javier (marido)', phone: '+34 600 000 000', notices: [{ name: 'Diabetes' }, { name: 'I take anticoagulants (Sintrom…)' }, { name: 'I have a pacemaker' }] }),
    };
    const sinOtras = { ...largo, card: { ...largo.card, show: { ...largo.card.show, otherAllergies: false } } };
    const l = lockQr(sinOtras);
    expect(l.cut).toEqual([]);
    expect(l.modules).toBeGreaterThan(69);
    expect(l.modules).toBeLessThanOrEqual(LOCK_QR_MAX_MODULES);
    // Con las alergias a alimentos además ya no cabe: son lo primero que se queda fuera
    expect(lockQr(largo).cut).toEqual(['Shellfish']);
    // La más larga posible: se queda fuera lo menos urgente, primero las otras alergias
    const custom = (n: number, len: number) => Array.from({ length: n }, (_, i) => ({ name: String.fromCharCode(65 + i).repeat(len), custom: true }));
    const enorme = {
      ...d,
      allergies: [...custom(9, 40).map((a) => ({ ...a, group: 'drugs' as const })), ...custom(4, 40).map((a) => ({ ...a, group: 'food' as const }))],
      card: card({ fullName: 'N'.repeat(80), contact: 'C'.repeat(80), phone: '6'.repeat(30), notices: custom(8, 60) }),
    };
    const e = lockQr(enorme);
    expect(e.modules).toBeLessThanOrEqual(LOCK_QR_MAX_MODULES);
    expect(e.cut.slice(0, 4)).toEqual(custom(4, 40).map((a) => a.name)); // las otras alergias, lo primero
    expect(e.text).not.toContain('Food and other allergies');
    expect(e.text).toContain('6'.repeat(30)); // el teléfono, siempre
    expect(e.text).toMatch(/and \d+ more/);
    const nombre = e.text.split('\n')[1]; // el nombre: entero o, si ni así cabe, acortado con «…»
    expect(nombre === 'N'.repeat(80) || (nombre.length <= 30 && nombre.endsWith('…'))).toBe(true);
  });

  it('el hueco del logo: centrado, pequeño, sin módulos dentro y el resto igual', () => {
    for (const text of [emergencyQrText(demoHistorial()), 'corto', 'x'.repeat(500)]) {
      const q = qrShape(text, { hole: true });
      const { size, cells } = qrCells(text);
      const hole = q.hole!;
      expect(q.size).toBe(size);
      expect(hole.w % 2).toBe(1);
      expect(hole.h % 2).toBe(1);
      expect(hole.x * 2 + hole.w).toBe(size); // centrado
      expect(hole.y * 2 + hole.h).toBe(size);
      expect((hole.w * hole.h) / (size * size)).toBeLessThanOrEqual(0.081); // el nivel H recupera el 30 %
      expect(hole.x).toBeGreaterThanOrEqual(9); // lejos de las marcas de las esquinas (7 + separador)
      // Volver a pintar el trazo: oscuros = los de toqr menos los del hueco
      const drawn = new Uint8Array(size * size);
      for (const m of q.path.matchAll(/M(\d+) (\d+)h(\d+)/g)) {
        const [x, y, run] = [Number(m[1]), Number(m[2]), Number(m[3])];
        for (let i = 0; i < run; i++) drawn[y * size + x + i] = 1;
      }
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const inHole = x >= hole.x && x < hole.x + hole.w && y >= hole.y && y < hole.y + hole.h;
          expect(drawn[y * size + x]).toBe(inHole ? 0 : cells[y * size + x] ? 1 : 0);
        }
    }
  });

  it('los avisos escritos que ya están en la lista son los de la lista', () => {
    let c = toggleNotice(emptyCard(), 'sintrom'); // = «I take anticoagulants (Sintrom…)»
    expect(c.notices).toEqual([{ name: 'I take anticoagulants (Sintrom…)' }]);
    c = toggleNotice(c, 'I TAKE ANTICOAGULANTS'); // lo de antes del paréntesis también: lo quita
    expect(c.notices).toEqual([]);
  });
});

describe('Fondo de la versión Bloqueo (2026-11-06)', () => {
  it('se guarda con la tarjeta si es uno de los que hay', () => {
    expect(normalizeHistorial({ card: { lockBg: 'sand' } }).card.lockBg).toBe('sand');
    expect(normalizeHistorial({ card: { lockBg: 'neon' } }).card.lockBg).toBeUndefined();
    expect(normalizeHistorial({ card: {} }).card).toEqual(emptyCard());
  });

  it('«tu foto» sin foto en este móvil es el verde; sin elegir, la foto si la hay', () => {
    expect(lockBackground({ lockBg: 'cream' }, true)).toBe('cream');
    expect(lockBackground({ lockBg: 'photo' }, false)).toBe('green');
    expect(lockBackground({}, true)).toBe('photo');
    expect(lockBackground({}, false)).toBe('green');
  });
});
