// Una cifra escrita con el teclado (las metas, 2026-11-20: «quiero que se pueda introducir el campo con el teclado,
// ahora sólo permite + −»). Se aceptan coma o punto decimal y los puntos de miles en español: «7500», «7.500»,
// «7,5», «7.5». Sin decimales, solo cuentan las cifras. null si no hay número.
export function parseTyped(text: string, decimals = false): number | null {
  let x = text.replace(/\s/g, '');
  if (!decimals) x = x.replace(/\D/g, '');
  else if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(x)) x = x.replace(/\./g, ''); // «1.500»: miles, no decimal
  x = x.replace(/[^\d.]/g, '');
  if (!/\d/.test(x)) return null;
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}
