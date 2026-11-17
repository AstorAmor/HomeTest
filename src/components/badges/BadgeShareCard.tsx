import React, { forwardRef } from 'react';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Achievement, achievementCategory, formatAchievementValue, formatReachedDay, TIER_NAMES } from '@/data/achievements';
import { GlowRingArt, ringTones } from '@/components/GlowRing';
import { BadgeGlyph, badgeEmblemMetrics, badgeProgress, badgeTone } from './BadgeEmblem';
import { t } from '@/i18n';

// La imagen que se comparte de una insignia (Instagram, WhatsApp…). Desde el 2026-11-16, como la insignia en
// grande (fundador: «más especial, seria y formal»): un diploma sobrio en esmeralda hondo, con un marco fino de
// oro, el mismo emblema que en la app (el aro de GlowRing y el grabado de la insignia con BadgeGlyph, en el color de
// su nivel y en las mismas proporciones que BadgeEmblem), el antetítulo en mayúsculas espaciadas, el nombre en letra
// fina, una raya corta, por qué se concedió y el día. Sin estrellas, destellos ni cintas.
// Todo en SVG para convertirla en imagen tal cual (utils/shareBadge: toDataURL en el móvil, un canvas en la web);
// por eso el dibujo va como trazo (badgeIconPaths.ts) y la marca con los trazos del logotipo: una fuente de iconos o
// de letra cargada no saldría en la imagen. Formato 4:5 (1080 × 1350), el vertical de Instagram.

export const CARD_W = 1080;
export const CARD_H = 1350;

const FONT = 'Helvetica, Arial, sans-serif';
const IVORY = '#F0EFE6';
const MUTE = '#8D9E95';
const GOLD = '#D8B978';

// Logotipo KUOVA (mismos trazos que KuovaWordmark): viewBox 226 189 1556 276
const KuovaMark = ({ cx, top, width, color }: { cx: number; top: number; width: number; color: string }) => {
  const k = width / 1556;
  return (
    <G transform={`translate(${cx - width / 2} ${top}) scale(${k}) translate(-226 -189)`}>
      <Path d="M230 200H268V327L427 200H490L333.67 315.49L480 457H424L302.58 338.45L268 364V402C267 430 250 450 230 457Z" fill={color} />
      <Path d="M561.5 198v141a103.5 103.5 0 0 0 207 0V198" fill="none" stroke={color} strokeWidth={37} />
      <Ellipse cx={990.5} cy={326.5} rx={126.5} ry={116.5} fill="none" stroke={color} strokeWidth={38} />
      <Path d="M1167 196h41l109 214 116-214h42l-142 260h-32Z" fill={color} />
      <Path d="M1593 196h39l146 261h-43l-123-214-128 214h-43Z" fill={color} />
    </G>
  );
};

export const BadgeShareCard = forwardRef<any, { achievement: Achievement; width: number }>(({ achievement: a, width }, ref) => {
  const earned = a.level > 0 && !!a.tier;
  const metal = badgeTone(a);
  const id = `bc-${a.id}`;
  const cx = CARD_W / 2;
  const cy = 470;
  const S = 470; // el emblema, como BadgeEmblem a este tamaño
  const m = badgeEmblemMetrics(S);
  const category = achievementCategory(a);
  const kicker = [t('Badge'), category].filter(Boolean).join(' · ').toUpperCase();
  const tierLine = earned
    ? `${t(a.tier!)} · ${t('Level {n} of {total}', { n: a.level, total: TIER_NAMES.length })}`.toUpperCase()
    : t('Not yet earned').toUpperCase();
  const day = earned ? a.reachedOn?.[a.level - 1] : null;
  // Por qué se concedió (lo que cuenta y la cifra del nivel) y desde cuándo
  const reason = earned ? `${a.description}: ${formatAchievementValue(a, a.thresholds[a.level - 1])}` : a.description;
  const detail = earned ? (day ? formatReachedDay(day) : '') : `${t('Now')}: ${formatAchievementValue(a, a.value)}`;
  // El nombre, en una línea: más pequeño si es largo
  const titleSize = Math.min(78, Math.round(900 / Math.max(1, a.title.length * 0.52)));
  const reasonSize = Math.min(32, Math.round(920 / Math.max(1, reason.length * 0.5)));

  return (
    <Svg ref={ref} width={width} height={(width * CARD_H) / CARD_W} viewBox={`0 0 ${CARD_W} ${CARD_H}`}>
      <Defs>
        <LinearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0B2921" />
          <Stop offset="0.55" stopColor="#08201A" />
          <Stop offset="1" stopColor="#061A16" />
        </LinearGradient>
        <RadialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#17634B" stopOpacity={0.55} />
          <Stop offset="0.5" stopColor="#17634B" stopOpacity={0.22} />
          <Stop offset="1" stopColor="#17634B" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      <Rect x={0} y={0} width={CARD_W} height={CARD_H} fill={`url(#${id}-bg)`} />
      <Ellipse cx={cx} cy={cy} rx={560} ry={520} fill={`url(#${id}-glow)`} />
      {/* Marco fino de oro, como un diploma */}
      <Rect x={44} y={44} width={CARD_W - 88} height={CARD_H - 88} rx={26} fill="none" stroke={GOLD} strokeOpacity={0.32} strokeWidth={2} />

      <SvgText x={cx} y={168} textAnchor="middle" fontFamily={FONT} fontSize={26} fill={MUTE} letterSpacing={9}>
        {kicker}
      </SvgText>

      {/* El emblema: el mismo de la app (BadgeEmblem), quieto */}
      <G transform={`translate(${cx - S / 2} ${cy - S / 2})`}>
        <GlowRingArt id={`${id}-ring`} progress={badgeProgress(a)} colors={ringTones(metal)} size={S} stroke={m.stroke} />
      </G>
      <BadgeGlyph a={a} x={cx - m.icon / 2} y={cy - m.icon / 2} size={m.icon} color={metal} />

      <SvgText x={cx} y={790} textAnchor="middle" fontFamily={FONT} fontSize={26} fill={metal} letterSpacing={9}>
        {tierLine}
      </SvgText>
      <SvgText x={cx} y={884} textAnchor="middle" fontFamily={FONT} fontSize={titleSize} fontWeight="300" fill={IVORY}>
        {a.title}
      </SvgText>
      <Rect x={cx - 56} y={928} width={112} height={2} fill={GOLD} opacity={0.6} />
      <SvgText x={cx} y={1000} textAnchor="middle" fontFamily={FONT} fontSize={reasonSize} fill="#CFD6CF">
        {reason}
      </SvgText>
      {detail ? (
        <SvgText x={cx} y={1050} textAnchor="middle" fontFamily={FONT} fontSize={27} fill={MUTE}>
          {detail}
        </SvgText>
      ) : null}

      {/* Marca */}
      <KuovaMark cx={cx} top={1158} width={196} color={IVORY} />
      <SvgText x={cx} y={1250} textAnchor="middle" fontFamily={FONT} fontSize={21} fill={MUTE} letterSpacing={6}>
        KUOVAHEALTH.COM
      </SvgText>
    </Svg>
  );
});
BadgeShareCard.displayName = 'BadgeShareCard';
