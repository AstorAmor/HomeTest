import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors } from '@/constants/colors';

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

export const KuovaAgeBadge = ({ size = 220, value, good = true }: { size?: number; value: string; good?: boolean }) => {
  const light = Colors.isLight;
  const ring = light ? '#B8904F' : '#C9A36B';
  const k = size / 220;
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: light ? '#F6F3EC' : '#0A1915' }}>
        <Image source={ART[light ? 'light' : 'dark'][good ? 'good' : 'watch']} style={{ width: size, height: size }} contentFit="cover" />
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
        <Text
          style={[
            styles.value,
            { fontSize: 60 * k, lineHeight: 68 * k, color: light ? '#0E2A24' : '#FFFFFF' },
            light ? styles.shadowLight : styles.shadowDark,
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  value: { fontWeight: '800' },
  // Sombra suave para que el número se lea sobre el brillo del corazón
  shadowDark: { textShadowColor: 'rgba(0,0,0,0.65)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  shadowLight: { textShadowColor: 'rgba(255,255,255,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 10 },
});
