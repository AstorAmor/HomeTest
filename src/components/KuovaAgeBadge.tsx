import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Defs, FeGaussianBlur, Filter, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { Colors, withAlpha } from '@/constants/colors';
import { KuovaAgeResult, PHENOAGE_INPUTS, PhenoAgeCoverage } from '@/logic/kuovaAge';
import type { PhenoInput } from '@/logic/phenoAge';
import { num, t } from '@/i18n';

// Insignia de la Edad KUOVA, el "buque insignia" de Mis datos: las "capas" de la marca (láminas
// apiladas con borde de ruido fractal, sin contorno; las eligió el fundador), recortadas en círculo,
// con el aro dorado y solo el número encima, en la meseta del centro. Hay cuatro versiones
// (assets/images/kuova-age, generadas con scripts/kuova-age-art.py): verde o verde con centro ámbar en
// tema oscuro y arena o terracota suave en claro, según si la Edad KUOVA sale por debajo (good) o por
// encima (watch) de la edad real.
const ART = {
  dark: { good: require('../../assets/images/kuova-age/dark_good.jpg'), watch: require('../../assets/images/kuova-age/dark_watch.jpg') },
  light: { good: require('../../assets/images/kuova-age/light_good.jpg'), watch: require('../../assets/images/kuova-age/light_watch.jpg') },
};

// locked: aún no hay Edad KUOVA (faltan valores o el método está sin validar). La misma insignia,
// difuminada y con un número borroso que no se puede leer, para que se vea qué se gana sin
// inventar ninguna cifra.
export const KuovaAgeBadge = ({ size = 220, value, good = true, locked = false }: { size?: number; value?: string; good?: boolean; locked?: boolean }) => {
  const light = Colors.isLight;
  const ring = light ? '#B8904F' : '#C9A36B';
  const k = size / 220;
  return (
    <View style={{ width: size, height: size, opacity: locked ? 0.8 : 1 }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: light ? '#F6F3EC' : '#0A1915' }}>
        <Image
          source={ART[light ? 'light' : 'dark'][good ? 'good' : 'watch']}
          style={{ width: size, height: size }}
          contentFit="cover"
          blurRadius={locked ? Math.round(size / 36) : undefined}
        />
      </View>
      <Svg width={size} height={size} viewBox="0 0 200 200" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="kaRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={ring} stopOpacity={1} />
            <Stop offset="0.5" stopColor={ring} stopOpacity={0.45} />
            <Stop offset="1" stopColor={ring} stopOpacity={0.95} />
          </LinearGradient>
        </Defs>
        <Circle cx={100} cy={100} r={98.6} fill="none" stroke="url(#kaRing)" strokeWidth={2} />
        <Circle cx={100} cy={100} r={94.5} fill="none" stroke={ring} strokeOpacity={0.35} strokeWidth={0.8} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        {locked ? (
          <BlurredNumber size={size} color={light ? '#0E2A24' : '#FFFFFF'} />
        ) : (
          <Text
            style={[
              styles.value,
              { fontSize: 60 * k, lineHeight: 68 * k, color: light ? '#0E2A24' : '#FFFFFF' },
              light ? styles.shadowLight : styles.shadowDark,
            ]}
          >
            {value}
          </Text>
        )}
      </View>
    </View>
  );
};

// El número desenfocado, en SVG porque Text no admite blur en iOS (react-native-svg sí, en las tres
// plataformas). Siempre "00,0": decorativo, no es la edad de nadie.
const BlurredNumber = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 200 200">
    <Defs>
      <Filter id="kaBlur" x="-30%" y="-60%" width="160%" height="220%">
        <FeGaussianBlur stdDeviation={4.5} />
      </Filter>
    </Defs>
    <SvgText
      x={100}
      y={119}
      fontSize={54.5}
      fontWeight="800"
      fontFamily={Platform.OS === 'web' ? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' : undefined}
      fill={color}
      fillOpacity={0.85}
      textAnchor="middle"
      filter="url(#kaBlur)"
    >
      {num('00.0')}
    </SvgText>
  </Svg>
);

const andList = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ${t('and')} ${items[items.length - 1]}`);

const inputLabel = (id: PhenoInput) => t(PHENOAGE_INPUTS.find((i) => i.id === id)!.label);

// La frase pequeña bajo la insignia difuminada: qué impide calcularla. Con pocos valores por medir,
// cuáles; con muchos, cuántos tiene ya; con los 9, lo que falte (fecha de nacimiento, PCR alta…).
export function kuovaAgeLockedHint(r: Exclude<KuovaAgeResult, { status: 'ok' }>): string {
  if (r.status === 'no_dob') return t('Add your date of birth to your profile and we will work it out.');
  if (r.status === 'age_range') return t('The KUOVA age is worked out for adults aged 20 to 84.');
  if (r.status === 'high_crp')
    return t('Your CRP came out above 10 mg/L, which is common after a cold or an infection and would distort it. Repeat the test in a few weeks.');
  if (r.status === 'unit') return t('We could not read the unit of your {marker}. Check it in Lab.', { marker: inputLabel(r.marker) });
  const c = r.coverage;
  if (c.have.length === 0) return t('It is worked out from 9 values of a routine blood test. Get the full blood test or upload yours to find out your KUOVA age.');
  if (c.missing.length <= 4) {
    const names = c.missing.map(inputLabel);
    return t('Test your {list} or get the full blood test to find out your KUOVA age.', { list: andList(names) });
  }
  return t('You have {n} of the 9 values. Get the full blood test to find out your KUOVA age.', { n: c.have.length });
}

// Nueve puntos, uno por valor: llenos los que ya tiene
export const KuovaAgeDots = ({ c }: { c: PhenoAgeCoverage }) => (
  <View style={styles.dots}>
    {PHENOAGE_INPUTS.map((i) => (
      <View key={i.id} style={[styles.dot, c.have.includes(i.id) ? { backgroundColor: Colors.gold } : { borderWidth: 1, borderColor: withAlpha(Colors.gold, 0.5) }]} />
    ))}
    <Text style={styles.dotsText}>{t('{n} of 9', { n: c.have.length })}</Text>
  </View>
);

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  value: { fontWeight: '800' },
  // Sombra suave para que el número se lea sobre el brillo del corazón
  shadowDark: { textShadowColor: 'rgba(0,0,0,0.65)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  shadowLight: { textShadowColor: 'rgba(255,255,255,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 10 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  dotsText: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', marginLeft: 4 },
});
