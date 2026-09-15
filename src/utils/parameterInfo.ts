function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// Explicaciones breves por parámetro. Ampliar según se necesite.
const PARAMETER_INFO: Record<string, string> = {
  hematies:
    'Mide la cantidad de glóbulos rojos en la sangre, encargados de transportar oxígeno por el organismo. Su valor puede variar según la edad, el sexo y otros factores.',
};

const DEFAULT_INFO = (nombre: string) =>
  `${nombre} es uno de los parámetros medidos en tu analítica. Los valores fuera del rango de referencia no implican necesariamente un problema de salud, pero conviene comentarlos con tu médico. (Contenido de ejemplo — próximamente información médica verificada por parámetro).`;

export function getParameterInfo(nombre: string): string {
  return PARAMETER_INFO[normalizeName(nombre)] ?? DEFAULT_INFO(nombre);
}
