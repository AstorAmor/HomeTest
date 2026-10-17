import React, { forwardRef } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Achievement, formatAchievementValue, TIER_GRADIENTS } from '@/data/achievements';
import { t } from '@/i18n';

// Tarjeta de una insignia para verla a pantalla completa y compartirla (Instagram, WhatsApp,
// TikTok…). Todo en SVG para poder convertirla en imagen tal cual se ve: en el móvil con
// toDataURL de react-native-svg y en la web pasando el <svg> a un canvas (utils/shareBadge).
// Formato 4:5 (1080 × 1350), el vertical de Instagram. Sin iconos de fuente: no salen en la imagen.

export const CARD_W = 1080;
export const CARD_H = 1350;

const LOCKED: [string, string, string] = ['#33413D', '#66766F', '#A7B4AE'];
const FONT = 'Helvetica, Arial, sans-serif';

// Estrella de 5 puntas centrada en (cx, cy)
const star = (cx: number, cy: number, outer: number, inner: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
};

// Destello de 4 puntas
const sparkle = (cx: number, cy: number, r: number) =>
  `M${cx},${cy - r} Q${cx + r * 0.18},${cy - r * 0.18} ${cx + r},${cy} Q${cx + r * 0.18},${cy + r * 0.18} ${cx},${cy + r} Q${cx - r * 0.18},${cy + r * 0.18} ${cx - r},${cy} Q${cx - r * 0.18},${cy - r * 0.18} ${cx},${cy - r}Z`;

// Gema (nivel diamante)
const gem = (cx: number, cy: number, w: number) => {
  const h = w * 0.9;
  return `M${cx - w / 2},${cy - h * 0.18} L${cx - w * 0.28},${cy - h / 2} L${cx + w * 0.28},${cy - h / 2} L${cx + w / 2},${cy - h * 0.18} L${cx},${cy + h / 2} Z`;
};

const SPARKLES = [
  [170, 220, 26],
  [905, 300, 34],
  [220, 760, 20],
  [880, 820, 24],
  [120, 470, 14],
  [960, 560, 16],
  [330, 140, 12],
  [760, 150, 18],
] as const;

export const BadgeShareCard = forwardRef<any, { achievement: Achievement; width: number }>(({ achievement: a, width }, ref) => {
  const [shade, mid, light] = a.tier ? TIER_GRADIENTS[a.tier] : LOCKED;
  const id = `bc-${a.id}`;
  const cx = CARD_W / 2;
  const cy = 500;
  const studs = Array.from({ length: 28 }, (_, i) => (i * 2 * Math.PI) / 28);
  const tierText = (a.tier ? t(a.tier) : t('Locked')).toUpperCase();
  const valueText = formatAchievementValue(a, a.value);

  return (
    <Svg ref={ref} width={width} height={(width * CARD_H) / CARD_W} viewBox={`0 0 ${CARD_W} ${CARD_H}`}>
      <Defs>
        <LinearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#0B231D" />
          <Stop offset="1" stopColor="#06120F" />
        </LinearGradient>
        <RadialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={mid} stopOpacity={a.tier ? 0.55 : 0.2} />
          <Stop offset="1" stopColor={mid} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id={`${id}-ring`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={light} />
          <Stop offset="0.45" stopColor={mid} />
          <Stop offset="1" stopColor={shade} />
        </LinearGradient>
        <RadialGradient id={`${id}-face`} cx="40%" cy="35%" r="75%">
          <Stop offset="0" stopColor={light} />
          <Stop offset="0.55" stopColor={mid} />
          <Stop offset="1" stopColor={shade} />
        </RadialGradient>
        <LinearGradient id={`${id}-ribbon`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={shade} />
          <Stop offset="1" stopColor={mid} />
        </LinearGradient>
      </Defs>

      <Rect x={0} y={0} width={CARD_W} height={CARD_H} fill={`url(#${id}-bg)`} />
      <Circle cx={cx} cy={cy} r={470} fill={`url(#${id}-glow)`} />
      {a.tier &&
        SPARKLES.map(([x, y, r], i) => <Path key={i} d={sparkle(x, y, r)} fill={light} opacity={0.85} />)}

      {/* Cintas */}
      <Path d={`M${cx - 150},${cy + 150} L${cx - 240},${cy + 300} L${cx - 170},${cy + 280} L${cx - 135},${cy + 335} L${cx - 40},${cy + 210} Z`} fill={`url(#${id}-ribbon)`} />
      <Path d={`M${cx + 150},${cy + 150} L${cx + 240},${cy + 300} L${cx + 170},${cy + 280} L${cx + 135},${cy + 335} L${cx + 40},${cy + 210} Z`} fill={`url(#${id}-ribbon)`} />

      {/* Medalla */}
      <Circle cx={cx} cy={cy} r={262} fill={shade} opacity={0.6} />
      <Circle cx={cx} cy={cy} r={250} fill={`url(#${id}-ring)`} />
      <Circle cx={cx} cy={cy} r={206} fill={`url(#${id}-face)`} stroke={light} strokeOpacity={0.6} strokeWidth={4} />
      <G>
        {studs.map((ang, i) => (
          <Circle key={i} cx={cx + 228 * Math.cos(ang)} cy={cy + 228 * Math.sin(ang)} r={6} fill={light} opacity={0.9} />
        ))}
      </G>
      {a.tier === 'Diamond' ? (
        <>
          <Path d={gem(cx, cy + 6, 220)} fill={light} opacity={0.95} />
          <Path d={`M${cx - 110},${cy - 34} L${cx + 110},${cy - 34} M${cx - 62},${cy - 93} L${cx - 30},${cy - 34} L${cx},${cy + 105} L${cx + 30},${cy - 34} L${cx + 62},${cy - 93}`} stroke={shade} strokeWidth={6} fill="none" strokeLinejoin="round" />
        </>
      ) : (
        <Path d={star(cx, cy + 8, 118, 50)} fill={a.tier ? light : '#C4CEC9'} opacity={a.tier ? 0.95 : 0.5} stroke={shade} strokeWidth={6} strokeLinejoin="round" />
      )}
      {a.level > 0 && (
        <SvgText x={cx} y={cy + 178} textAnchor="middle" fontFamily={FONT} fontSize={34} fontWeight="700" fill={shade} letterSpacing={6}>
          {'★'.repeat(a.level)}
        </SvgText>
      )}

      {/* Textos */}
      <SvgText x={cx} y={925} textAnchor="middle" fontFamily={FONT} fontSize={40} fontWeight="700" fill={mid} letterSpacing={10}>
        {tierText}
      </SvgText>
      <SvgText x={cx} y={1010} textAnchor="middle" fontFamily={FONT} fontSize={76} fontWeight="800" fill="#FFFFFF">
        {a.title}
      </SvgText>
      <SvgText x={cx} y={1076} textAnchor="middle" fontFamily={FONT} fontSize={44} fontWeight="700" fill="#F0B84D">
        {valueText}
      </SvgText>
      <SvgText x={cx} y={1126} textAnchor="middle" fontFamily={FONT} fontSize={30} fill="#A9C4BB">
        {a.description}
      </SvgText>

      {/* Marca */}
      <Rect x={cx - 60} y={1180} width={120} height={3} fill="#F0B84D" opacity={0.7} />
      <SvgText x={cx} y={1250} textAnchor="middle" fontFamily={FONT} fontSize={48} fontWeight="800" fill="#FFFFFF" letterSpacing={18}>
        KUOVA
      </SvgText>
      <SvgText x={cx} y={1298} textAnchor="middle" fontFamily={FONT} fontSize={26} fill="#A9C4BB" letterSpacing={4}>
        kuovahealth.com
      </SvgText>
    </Svg>
  );
});
BadgeShareCard.displayName = 'BadgeShareCard';
