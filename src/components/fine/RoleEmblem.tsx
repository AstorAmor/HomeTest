// Los dibujos de los especialistas (fundador, 2026-11-16: los iconos de los especialistas «se ven muy gordos y no
// alineados con la estética»). Antes eran manchas de color (BlobArt) con un icono relleno grande; ahora, un dibujo a
// línea por rol, como los grabados de las insignias (badges/badgeIconPaths.ts) y los temas de Aprende
// (fine/LineEmblem.tsx): trazos a 24 × 24, sin relleno, todos del mismo grueso y de un tamaño visual parecido, en un
// solo color. Por defecto en oro: en la paleta fina (theme/fine.ts) el oro es lo de pago, y una consulta lo es.
// La clave es el rol (ProfessionalRole): el carrusel de Análisis, el filtro de Profesionales y «Habla con un
// especialista» pintan el mismo dibujo, así no pueden salir distintos. Se dibujaron a mano y se revisaron en una
// lámina a 16, 40, 76 y 96 px.
import { useId } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import type { ProfessionalRole } from '@/data/servicesMock';
import { FINE, ff } from '@/theme/fine';
import { DUMBBELL_PATH } from './dumbbell';

export const ROLE_EMBLEM_PATHS: Record<ProfessionalRole, string> = {
  // Médico: un fonendoscopio (las olivas, los dos tubos y la campana)
  doctor: 'M4.5 4H6M12 4h1.5M6 4v5.5a3 3 0 0 0 6 0V4M9 12.5V16a4 4 0 0 0 8 0v-1.8M17 9.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 1 0 0-4.4z',
  // Psicólogo: una cabeza de perfil con un corazón dentro (el mismo dibujo que el tema de Aprende)
  psychologist:
    'M8.5 21v-4.6C6.3 15 5 12.7 5 10a7 7 0 0 1 13.4-2.8l1.9 4.8-1.8.6V15a1.5 1.5 0 0 1-1.5 1.5h-1.5V21M11.5 12.6s-2.6-1.6-2.6-3.4a1.4 1.4 0 0 1 2.6-.7 1.4 1.4 0 0 1 2.6.7c0 1.8-2.6 3.4-2.6 3.4z',
  // Matrona: una mujer embarazada de perfil, solo el contorno
  midwife:
    'M10.2 2.6a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 1 0 0-3.8zM8.7 21v-5.8c-.9-1.5-1.2-3.5-.7-5.6.3-1.2 1-1.8 2.1-1.8s1.8.6 2.1 1.6c.2.7.3 1.2.3 1.8 2.4.8 3.8 2.6 3.8 4.6 0 2.2-1.6 3.6-4.1 3.8V21',
  // Dietista: una manzana con su hoja (la de Aprende)
  dietitian:
    'M12 7.5c-1.4-1-3.8-1.3-5.3.3C4.9 9.6 5.2 13.4 6.6 16.3 7.8 18.8 9.6 20.6 11.2 20c.5-.2.6-.3.8-.3s.3.1.8.3c1.6.6 3.4-1.2 4.6-3.7 1.4-2.9 1.7-6.7-.1-8.5-1.5-1.6-3.9-1.3-5.3-.3zM12 7.5c0-2 .8-3.5 2.6-4.3M12 6.5c-1.5-.2-2.8-1.2-3.2-2.8 1.6-.2 2.9.7 3.2 2.8z',
  // Entrenador: una mancuerna con sus discos. Es el dibujo único de las pesas de toda la app (fine/dumbbell.ts)
  trainer: DUMBBELL_PATH,
  // Fisioterapeuta: la columna, cinco vértebras con sus apófisis, más anchas abajo y con una curva suave
  physio:
    'M11.95 3.75h1.3a1.15 1.15 0 0 1 0 2.3h-1.3a1.15 1.15 0 0 1 0-2.3zM8.8 4.9h1.4M15 4.9h1.4M11.15 7.3h1.7a1.15 1.15 0 0 1 0 2.3h-1.7a1.15 1.15 0 0 1 0-2.3zM8 8.45h1.4M14.6 8.45h1.4M10.65 10.85h2.1a1.15 1.15 0 0 1 0 2.3h-2.1a1.15 1.15 0 0 1 0-2.3zM7.5 12h1.4M14.5 12h1.4M10.55 14.4h2.5a1.15 1.15 0 0 1 0 2.3h-2.5a1.15 1.15 0 0 1 0-2.3zM7.4 15.55h1.4M14.8 15.55h1.4M10.75 17.95h2.9a1.15 1.15 0 0 1 0 2.3h-2.9a1.15 1.15 0 0 1 0-2.3zM7.6 19.1h1.4M15.4 19.1h1.4',
  // Asesor genético: la doble hélice
  geneticist: 'M7 3c0 4.5 10 4.5 10 9s-10 4.5-10 9M17 3c0 4.5-10 4.5-10 9s10 4.5 10 9M7 12h10M7.9 5h8.2M7.9 19h8.2',
};

// La tarjeta «ver todos» del final del carrusel (si se pide): una cuadrícula
export const GRID_EMBLEM_PATH = 'M5.5 5.5h5v5h-5zM13.5 5.5h5v5h-5zM5.5 13.5h5v5h-5zM13.5 13.5h5v5h-5z';

// Un rol sin dibujo propio (no debería pasar) sale con el fonendoscopio
export const roleEmblemPath = (role: string) => ROLE_EMBLEM_PATHS[role as ProfessionalRole] ?? ROLE_EMBLEM_PATHS.doctor;

// Solo el dibujo, del tamaño pedido (los chips del filtro); `stroke`, en píxeles de pantalla a cualquier tamaño
export function PathIcon({ d, size = 18, color = FINE.mute, stroke = 1.3 }: { d: string; size?: number; color?: string; stroke?: number }) {
  return (
    <View style={{ width: size, height: size }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={d} fill="none" stroke={color} strokeWidth={(stroke * 24) / size} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

export function RoleIcon({ role, ...rest }: { role: string; size?: number; color?: string; stroke?: number }) {
  return <PathIcon d={roleEmblemPath(role)} {...rest} />;
}

// El dibujo dentro de un aro fino con una luz apenas marcada dentro, como LineEmblem. `glow`: un halo suave a lo
// largo del aro (la tarjeta del carrusel, más grande).
export function PathEmblem({
  d,
  size = 40,
  color = FINE.gold,
  glow,
  ratio = 0.54,
  style,
}: {
  d: string;
  size?: number;
  color?: string;
  glow?: boolean;
  ratio?: number; // tamaño del dibujo respecto al aro
  style?: StyleProp<ViewStyle>;
}) {
  const id = `re${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const c = size / 2;
  // Con halo, el aro deja sitio alrededor para que la luz no se corte en el borde
  const r = glow ? c * 0.8 : c - 1;
  const iconSize = r * 2 * ratio;
  const k = iconSize / 24;
  const lineW = glow ? Math.max(1, size / 150) : 1;
  const iconStroke = glow ? Math.max(1.3, size / 110) : 1.3;
  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`${id}i`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="0.7" stopColor={color} stopOpacity={0.04} />
            <Stop offset="1" stopColor={color} stopOpacity={glow ? 0.12 : 0.08} />
          </RadialGradient>
          {glow && (
            <RadialGradient id={`${id}h`} cx="50%" cy="50%" r="50%">
              <Stop offset={String((r * 0.86) / c)} stopColor={color} stopOpacity={0} />
              <Stop offset={String(r / c)} stopColor={color} stopOpacity={0.16} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          )}
        </Defs>
        {glow && <Circle cx={c} cy={c} r={c} fill={`url(#${id}h)`} />}
        <Circle cx={c} cy={c} r={r} fill={`url(#${id}i)`} />
        <Circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeOpacity={glow ? 0.7 : 0.5} strokeWidth={lineW} />
        <G transform={`translate(${c - iconSize / 2} ${c - iconSize / 2}) scale(${k})`}>
          <Path d={d} fill="none" stroke={color} strokeWidth={iconStroke / k} strokeLinecap="round" strokeLinejoin="round" />
        </G>
      </Svg>
    </View>
  );
}

export function RoleEmblem({ role, ...rest }: { role: string; size?: number; color?: string; glow?: boolean; ratio?: number; style?: StyleProp<ViewStyle> }) {
  return <PathEmblem d={roleEmblemPath(role)} {...rest} />;
}

// La inicial de un especialista sin foto, en un aro fino (en lugar del círculo relleno de Avatar): letra ligera en
// marfil, aro en oro apagado. Sin el «Dr.»/«Dra.» delante.
export function Monogram({ name, size = 44, color = FINE.goldLine }: { name: string; size?: number; color?: string }) {
  const initial = name.replace(/^Dra?\.\s*/, '').trim().charAt(0).toUpperCase();
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: color, backgroundColor: FINE.tile, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={{ ...ff('light'), fontSize: Math.round(size * 0.4), color: FINE.ivory }}>{initial}</Text>
    </View>
  );
}
