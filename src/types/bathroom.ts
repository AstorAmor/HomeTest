// Registro de salud digestiva (heces) y urinaria que hace el propio usuario, un apunte por día.
// No pide la hora (no aporta casi nada) y evita lo desagradable: colores en una escala suave y
// formas abstractas para la consistencia (escala de Bristol simplificada), sin emojis.

export type StoolColor = 'brown' | 'light_brown' | 'yellow' | 'green' | 'black' | 'red' | 'pale';

// Escala de Bristol: 1 bolitas duras … 4 suave y con forma … 7 líquida
export type BristolType = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface BowelEntry {
  id: string;
  fecha: string; // ISO del día del apunte (mediodía local)
  createdAt: string;
  count: number; // veces que ha ido ese día (0 = ninguna)
  color?: StoolColor;
  consistency?: BristolType;
  note?: string;
  // Respuesta a "¿has comido o tomado algo que lo explique?" cuando el color es llamativo
  explainedBy?: string;
}

export const STOOL_COLORS: { id: StoolColor; label: string; swatch: string; flag?: 'ask' | 'doctor' }[] = [
  { id: 'brown', label: 'Brown', swatch: '#7A5134' },
  { id: 'light_brown', label: 'Light brown', swatch: '#A9784F' },
  { id: 'yellow', label: 'Yellowish', swatch: '#C9A43E' },
  { id: 'green', label: 'Greenish', swatch: '#6E7F3A' },
  { id: 'black', label: 'Very dark / black', swatch: '#2B2622', flag: 'ask' },
  { id: 'red', label: 'Reddish', swatch: '#9E3B32', flag: 'ask' },
  { id: 'pale', label: 'Pale / clay', swatch: '#CFC6B3', flag: 'doctor' },
];

export const BRISTOL_TYPES: { id: BristolType; label: string; hint: string }[] = [
  { id: 1, label: 'Small hard pellets', hint: 'Separate, hard to pass' },
  { id: 2, label: 'Lumpy', hint: 'Shaped but lumpy and hard' },
  { id: 3, label: 'Cracked', hint: 'Shaped, with cracks on the surface' },
  { id: 4, label: 'Smooth and soft', hint: 'Shaped and easy to pass' },
  { id: 5, label: 'Soft pieces', hint: 'Soft blobs with clear edges' },
  { id: 6, label: 'Mushy', hint: 'Fluffy, creamy pieces' },
  { id: 7, label: 'Liquid', hint: 'Watery, no solid pieces' },
];

export type UrineColor = 'clear' | 'pale' | 'yellow' | 'dark' | 'amber' | 'brown' | 'red' | 'cloudy';

// Prueba de volumen de una micción con una botella de 500 ml: hasta dónde se llenó
export type VoidVolume = 'quarter' | 'half' | 'three_quarters' | 'full';

export interface UrineEntry {
  id: string;
  fecha: string; // ISO del día del apunte (mediodía local)
  createdAt: string;
  count?: number; // veces que ha orinado ese día
  nightCount?: number; // veces que se ha levantado por la noche a orinar
  color?: UrineColor;
  burning?: boolean; // escozor o dolor al orinar
  voidVolume?: VoidVolume; // prueba de la botella
  volumeUsual?: 'yes' | 'no' | 'unsure'; // "¿sueles orinar más o menos eso?"
  dailyTotalMl?: number; // con un bote de orina de 24 h de la farmacia
  note?: string;
  explainedBy?: string;
}

export const URINE_COLORS: { id: UrineColor; label: string; swatch: string; flag?: 'ask' | 'doctor' }[] = [
  { id: 'clear', label: 'Clear', swatch: '#F4F1E4' },
  { id: 'pale', label: 'Pale straw', swatch: '#F3E7A6' },
  { id: 'yellow', label: 'Yellow', swatch: '#EDD35C' },
  { id: 'dark', label: 'Dark yellow', swatch: '#D9A93A' },
  { id: 'amber', label: 'Amber / honey', swatch: '#B97A24' },
  { id: 'brown', label: 'Brown', swatch: '#7B4A22', flag: 'doctor' },
  { id: 'red', label: 'Pink or red', swatch: '#C4626A', flag: 'ask' },
  { id: 'cloudy', label: 'Cloudy', swatch: '#E3DED0' },
];

export const VOID_VOLUMES: { id: VoidVolume; label: string; ml: number }[] = [
  { id: 'quarter', label: 'About a quarter', ml: 125 },
  { id: 'half', label: 'About half', ml: 250 },
  { id: 'three_quarters', label: 'About three quarters', ml: 375 },
  { id: 'full', label: 'Full or more', ml: 500 },
];
