function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// Short descriptions per parameter. Expand as needed.
const PARAMETER_INFO: Record<string, string> = {
  hematies:
    'Measures the number of red blood cells in your blood, responsible for carrying oxygen throughout the body. Values can vary by age, sex, and other factors.',
};

const DEFAULT_INFO = (nombre: string) =>
  `${nombre} is one of the parameters measured in your lab report. Values outside the reference range don't necessarily mean a health issue, but it's worth discussing with your doctor. (Sample content — verified medical information per parameter coming soon).`;

export function getParameterInfo(nombre: string): string {
  return PARAMETER_INFO[normalizeName(nombre)] ?? DEFAULT_INFO(nombre);
}
