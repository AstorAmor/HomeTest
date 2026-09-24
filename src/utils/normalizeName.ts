// Normalizacion compartida de nombres de parametro (minusculas, sin acentos,
// espacios/simbolos -> guion_bajo). Antes vivia duplicada en unitConversion.ts
// y parameterInfo.ts; ahora es el unico sitio, usado tambien para mapear
// nombres extraidos a canonical_id en knowledge/mapping/extracted-name-aliases.json.
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
