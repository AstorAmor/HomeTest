import React, { forwardRef, useMemo } from 'react';
import Svg, { Circle, Defs, Ellipse, G, Image as SvgImage, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { t } from '@/i18n';
import { cardContent, CardContent, emergencyQrText, Historial, LockBg, lockQr, wrapLines } from '@/logic/historial';
import { qrShape } from '@/logic/qr';

// Tarjeta de emergencia: la de la pantalla y la imagen que se guarda o se comparte (todo en SVG para que
// la imagen salga igual que se ve; utils/shareBadge la pasa a PNG). Tres versiones (fundador,
// 2026-11-05):
// - 'full': los datos que elijas y el QR. 1080 de ancho; el alto crece con lo que lleve (mínimo 1350).
// - 'compact': el nombre y el QR, 1080 × 1350.
// - 'lock': fondo de pantalla de bloqueo, 1080 × 2340: tu foto o uno de los fondos de la marca (verde con
//   ondas, capas verdes, crema, capas de arena; 2026-11-06) y el
//   QR en el tercio de abajo, donde no lo tapa el reloj ni los botones de las esquinas. Encima del QR, solo
//   qué es y cómo leerlo: desde el 2026-11-09, el asterisco rojo y «Datos médicos» (antes una placa con
//   «INFORMACIÓN DE EMERGENCIA»), y el QR más pequeño; los datos van en el QR (sin la dirección, que la
//   vería cualquiera que coja el móvil).
// Todos los QR llevan en medio la K dorada y el logotipo KUOVA / HEALTH. Colores de la marca: verde
// #0E2A2A, dorado #C9A366, crema #FAF7EF. El QR lleva el texto de la tarjeta: se lee sin internet.

export type CardVariant = 'full' | 'compact' | 'lock';
export const EC_W = 1080;
export const EC_H = 1350;
export const LOCK_H = 2340;

const FONT = 'Helvetica, Arial, sans-serif';
const GREEN = '#0E2A2A';
const GREEN_DEEP = '#071817';
const GOLD = '#C9A366';
const GOLD_DARK = '#94713A'; // el dorado sobre crema (el claro apenas se lee ahí)
const CREAM = '#FAF7EF';
const SOFT = '#A9C4BB';

// La K del logotipo (KuovaMonogram): viewBox 0 0 260 257
const K_PATH = 'M0 0H38V127L197 0H260L103.67 115.49L250 257H194L72.58 138.45L38 164V202C37 230 20 250 0 257Z';

// Logotipo KUOVA (los trazos de KuovaLogo.tsx): viewBox 226 189 1556 276
const KuovaMark = ({ x, top, width, color }: { x: number; top: number; width: number; color: string }) => {
  const k = width / 1556;
  return (
    <G transform={`translate(${x} ${top}) scale(${k}) translate(-226 -189)`}>
      <Path d="M230 200H268V327L427 200H490L333.67 315.49L480 457H424L302.58 338.45L268 364V402C267 430 250 450 230 457Z" fill={color} />
      <Path d="M561.5 198v141a103.5 103.5 0 0 0 207 0V198" fill="none" stroke={color} strokeWidth={37} />
      <Ellipse cx={990.5} cy={326.5} rx={126.5} ry={116.5} fill="none" stroke={color} strokeWidth={38} />
      <Path d="M1167 196h41l109 214 116-214h42l-142 260h-32Z" fill={color} />
      <Path d="M1593 196h39l146 261h-43l-123-214-128 214h-43Z" fill={color} />
    </G>
  );
};

// ===== Dónde va cada cosa (en unidades de la imagen) =====
interface Placed {
  label: string;
  labelY: number;
  lines: string[];
  ys: number[];
}
export interface CardLayout {
  w: number;
  h: number;
  qr: { x: number; y: number; size: number };
  k: CardContent;
  nameLines: string[];
  nameY: number[];
  bloodY: number | null; // la etiqueta; el valor va 100 más abajo
  sections: Placed[];
}

const MAX_LINES: Record<string, number> = { drugAllergies: 3, notices: 3, otherAllergies: 2, contact: 2, address: 2 };

function placeSections(k: CardContent, startY: number, o: { chars: number; step: number; gap: number; first: number }): Placed[] {
  const out: Placed[] = [];
  let y = startY;
  for (const s of k.sections) {
    const lines = wrapLines(s.text, o.chars, MAX_LINES[s.field] ?? 2);
    const ys = lines.map((_, i) => y + o.first + i * o.step);
    out.push({ label: s.label, labelY: y, lines, ys });
    y = ys[ys.length - 1] + o.gap;
  }
  return out;
}

// El QR del fondo de pantalla (fundador, 2026-11-09, por lo que piden los probadores: «más pequeño», y luego
// «más pequeño» otra vez): 380 de lado (antes 560), centrado y acabando en el 2130, en el tercio de abajo
// (empieza en el 1560), entre los botones de linterna y cámara del iPhone. Crece solo si la tarjeta lleva
// mucho texto, para que cada módulo mida al menos 5,2 px (unos 0,31 mm en la pantalla): por debajo, la
// cámara de otro móvil ya no lo lee a 20-25 cm (ver lockQr en logic/historial).
const LOCK_QR_BOTTOM = 2130;
const LOCK_CENTER = { x: EC_W / 2, y: LOCK_QR_BOTTOM - 190 }; // de donde salen las ondas del fondo verde
export function lockQrBox(modules: number) {
  const size = Math.min(560, Math.max(380, Math.ceil(((modules + 8) * 5.2) / 2) * 2));
  return { x: (EC_W - size) / 2, y: LOCK_QR_BOTTOM - size, size };
}

export function cardLayout(h: Historial, variant: CardVariant): CardLayout {
  const k = cardContent(h, { lock: variant === 'lock' });
  if (variant === 'lock') return { w: EC_W, h: LOCK_H, qr: lockQrBox(lockQr(h).modules), k, nameLines: [], nameY: [], bloodY: null, sections: [] };
  if (variant === 'compact') {
    const nameLines = k.name != null ? wrapLines(k.name, 26, 2) : [];
    const nameY = nameLines.map((_, i) => 236 + i * 66);
    const top = nameLines.length ? nameY[nameY.length - 1] + 100 : 250;
    return { w: EC_W, h: EC_H, qr: { x: 160, y: top, size: 760 }, k, nameLines, nameY, bloodY: null, sections: [] };
  }
  const nameLines = k.name != null ? wrapLines(k.name, 24, 2) : [];
  const nameY = nameLines.map((_, i) => 236 + i * 72);
  const top = nameLines.length ? nameY[nameY.length - 1] + 102 : 220;
  const bloodY = k.blood != null ? top + 30 : null;
  const start = top + 420 + 70;
  const sections = placeSections(k, start, { chars: 36, step: 52, gap: 76, first: 58 });
  const end = sections.length ? sections[sections.length - 1].ys[sections[sections.length - 1].ys.length - 1] : top + 420;
  return { w: EC_W, h: Math.max(EC_H, Math.ceil(end + 150)), qr: { x: 570, y: top, size: 420 }, k, nameLines, nameY, bloodY, sections };
}

const Background = ({ w, h }: { w: number; h: number }) => (
  <>
    <Defs>
      <LinearGradient id="ec-bg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={GREEN} />
        <Stop offset="1" stopColor={GREEN_DEEP} />
      </LinearGradient>
    </Defs>
    <Rect x={0} y={0} width={w} height={h} fill="url(#ec-bg)" />
    {/* Las «capas» de la marca: arcos finos dorados en una esquina */}
    {[220, 290, 360, 430].map((r, i) => (
      <Circle key={r} cx={w + 40} cy={-40} r={r} fill="none" stroke={GOLD} strokeOpacity={0.22 - i * 0.04} strokeWidth={3} />
    ))}
  </>
);

// Una capa: una lámina que sube desde abajo con el borde de arriba en curva suave (dos senos, sin azar, para
// que la imagen salga siempre igual), cerrada por abajo. Catmull-Rom → Bézier para que no haya picos.
function sheetPath(top: number, amp: number, phase: number): string {
  const n = 8;
  const pts = Array.from({ length: n + 3 }, (_, j) => {
    const i = j - 1; // un punto de más a cada lado, fuera de la imagen
    const u = i / n;
    return [u * EC_W, top + amp * Math.sin(2 * Math.PI * u * 1.1 + phase) + amp * 0.45 * Math.sin(2 * Math.PI * u * 2.3 + phase * 1.7)];
  });
  let d = `M${pts[1][0]} ${pts[1][1].toFixed(1)}`;
  for (let i = 1; i <= n; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d}V${LOCK_H}H0Z`;
}

// Cinco capas, de la de atrás (arriba) a la de delante (abajo); la sombra tenue va justo encima de cada borde
const SHEETS = [
  { top: 1180, amp: 70, phase: 0.4 },
  { top: 1420, amp: 64, phase: 2.1 },
  { top: 1680, amp: 58, phase: 3.7 },
  { top: 1950, amp: 52, phase: 5.2 },
  { top: 2190, amp: 44, phase: 1.3 },
];
const SHEET_COLORS = {
  layers: { sky: ['#1B4642', GREEN], fills: ['#163E3A', '#123532', '#0F2D2B', '#0B2423', GREEN_DEEP], shadow: '#000000', shadowOpacity: 0.2 },
  sand: { sky: [CREAM, '#F4EDDF'], fills: ['#EFE6D4', '#E7DBC4', '#DECFB3', '#D4C2A2', '#C9B48F'], shadow: '#5C4520', shadowOpacity: 0.1 },
};

const Sheets = ({ kind, idp }: { kind: 'layers' | 'sand'; idp: string }) => {
  const c = SHEET_COLORS[kind];
  const paths = useMemo(() => SHEETS.map((s) => sheetPath(s.top, s.amp, s.phase)), []);
  return (
    <>
      <Defs>
        <LinearGradient id={`ec-sky-${idp}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.sky[0]} />
          <Stop offset="1" stopColor={c.sky[1]} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={EC_W} height={LOCK_H} fill={`url(#ec-sky-${idp})`} />
      {paths.map((d, i) => (
        <G key={i}>
          <Path d={d} fill={c.shadow} fillOpacity={c.shadowOpacity} transform="translate(0 -14)" />
          <Path d={d} fill={c.fills[i]} />
        </G>
      ))}
    </>
  );
};

// Los fondos claros llevan el QR con un halo verde suave en vez de blanco
export const lightLockBg = (bg: LockBg) => bg === 'cream' || bg === 'sand';

// Fondo de pantalla: tu foto, cubriendo todo (centrada), con una sombra suave abajo para que el QR destaque;
// o uno de la marca: verde con las «capas» saliendo del QR como ondas, láminas verdes, crema con ondas
// doradas o láminas de arena. `idp` separa los degradados de cada dibujo (en la web los id son de toda la
// página y las miniaturas los pisarían).
export const LockBackground = ({ bg, photo, idp = 'card' }: { bg: LockBg; photo?: string | null; idp?: string }) => {
  const cx = LOCK_CENTER.x;
  const cy = LOCK_CENTER.y;
  if (bg === 'photo' && photo) {
    return (
      <>
        <Defs>
          <LinearGradient id={`ec-lock-scrim-${idp}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.4} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={EC_W} height={LOCK_H} fill={GREEN_DEEP} />
        <SvgImage href={photo} x={0} y={0} width={EC_W} height={LOCK_H} preserveAspectRatio="xMidYMid slice" />
        <Rect x={0} y={LOCK_H * 0.5} width={EC_W} height={LOCK_H * 0.5} fill={`url(#ec-lock-scrim-${idp})`} />
      </>
    );
  }
  if (bg === 'layers' || bg === 'sand') return <Sheets kind={bg} idp={idp} />;
  const light = bg === 'cream';
  return (
    <>
      <Defs>
        <LinearGradient id={`ec-lock-bg-${idp}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={light ? CREAM : '#173D3A'} />
          <Stop offset="0.55" stopColor={light ? '#F5EFE2' : GREEN} />
          <Stop offset="1" stopColor={light ? '#ECE2CD' : GREEN_DEEP} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={EC_W} height={LOCK_H} fill={`url(#ec-lock-bg-${idp})`} />
      {[380, 470, 560, 650, 740, 830, 920].map((r, i) => (
        <Circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke={light ? GOLD_DARK : GOLD} strokeOpacity={(light ? 0.36 : 0.3) - i * 0.04} strokeWidth={i === 0 ? 4 : 3} />
      ))}
    </>
  );
};

// Miniatura de un fondo para elegirlo (sin QR ni textos)
export const LockBgPreview = ({ bg, photo, width }: { bg: LockBg; photo?: string | null; width: number }) => (
  <Svg width={width} height={(width * LOCK_H) / EC_W} viewBox={`0 0 ${EC_W} ${LOCK_H}`}>
    <LockBackground bg={bg} photo={photo} idp={`tile-${bg}`} />
  </Svg>
);

const Header = ({ y, text }: { y: number; text: string }) => (
  <>
    <Rect x={90} y={y} width={64} height={64} rx={16} fill={GOLD} />
    <Path d={`M114 ${y + 12}h16v16h16v16h-16v16h-16v-16h-16v-16h16z`} fill={GREEN} />
    <SvgText x={176} y={y + 44} fontFamily={FONT} fontSize={32} fontWeight="800" fill={GOLD} letterSpacing={6}>
      {text}
    </SvgText>
  </>
);

// El sello del centro de cada QR (fundador, 2026-11-05): la K en dorado y, debajo, el logotipo KUOVA con
// HEALTH en la línea de abajo, espaciado como en la web. Ocupa el hueco que deja qrShape (sin módulos),
// medio módulo más adentro por cada lado; centrado en alto.
const QrBadge = ({ x, y, w, h, bg }: { x: number; y: number; w: number; h: number; bg: string }) => {
  const kh = h * 0.4;
  const kw = (kh * 260) / 257;
  const mw = Math.min(w * 0.66, h * 0.8); // ancho del logotipo
  const mh = (mw * 276) / 1556;
  const fs = mh * 0.52; // HEALTH: como en la web, algo más de la mitad del alto de KUOVA
  const g1 = h * 0.085;
  const g2 = mh * 0.42;
  const cap = fs * 0.72;
  const top = y + (h - (kh + g1 + mh + g2 + cap)) / 2;
  const r = Math.min(w, h) * 0.16;
  const line = h * 0.014;
  return (
    <>
      <Rect x={x} y={y} width={w} height={h} rx={r} fill={bg} />
      <Rect x={x + line * 2} y={y + line * 2} width={w - line * 4} height={h - line * 4} rx={r - line * 2} fill="none" stroke={GOLD} strokeOpacity={0.55} strokeWidth={line} />
      <G transform={`translate(${x + (w - kw) / 2} ${top}) scale(${kh / 257})`}>
        <Path d={K_PATH} fill={GOLD} />
      </G>
      <KuovaMark x={x + (w - mw) / 2} top={top + kh + g1} width={mw} color={GREEN} />
      {/* El espaciado deja aire tras la última H: se compensa moviendo el centro medio espacio */}
      <SvgText x={x + w / 2 + fs * 0.3} y={top + kh + g1 + mh + g2 + cap} textAnchor="middle" fontFamily={FONT} fontSize={fs} fontWeight="600" fill={GOLD_DARK} letterSpacing={fs * 0.6}>
        HEALTH
      </SvgText>
    </>
  );
};

// Un QR con su margen (4 módulos, lo que piden los lectores) y el sello en medio, en píxeles de la imagen
export const QrCode = ({ text, x, y, size, fg = GREEN_DEEP, bg = CREAM, radius = 0.07 }: { text: string; x: number; y: number; size: number; fg?: string; bg?: string; radius?: number }) => {
  const qr = useMemo(() => qrShape(text, { hole: true }), [text]);
  const cell = size / (qr.size + 8);
  const ox = x + 4 * cell;
  const oy = y + 4 * cell;
  const hole = qr.hole;
  return (
    <>
      <Rect x={x} y={y} width={size} height={size} rx={size * radius} fill={bg} />
      <G transform={`translate(${ox} ${oy}) scale(${cell})`}>
        <Path d={qr.path} fill={fg} />
      </G>
      {hole && <QrBadge x={ox + (hole.x + 0.5) * cell} y={oy + (hole.y + 0.5) * cell} w={(hole.w - 1) * cell} h={(hole.h - 1) * cell} bg={bg} />}
    </>
  );
};

const Sections = ({ list, label, value }: { list: Placed[]; label: number; value: number }) => (
  <>
    {list.map((s) => (
      <G key={s.labelY}>
        <SvgText x={90} y={s.labelY} fontFamily={FONT} fontSize={label} fontWeight="700" fill={SOFT} letterSpacing={5}>
          {s.label.toUpperCase()}
        </SvgText>
        {s.lines.map((line, i) => (
          <SvgText key={i} x={90} y={s.ys[i]} fontFamily={FONT} fontSize={value} fontWeight="700" fill="#FFFFFF">
            {line}
          </SvgText>
        ))}
      </G>
    ))}
  </>
);

// La firma, abajo
const Signature = ({ y }: { y: number }) => (
  <>
    <Rect x={0} y={y} width={EC_W} height={100} fill={GREEN_DEEP} opacity={0.6} />
    <KuovaMark x={90} top={y + 29} width={220} color="#FFFFFF" />
    <SvgText x={330} y={y + 64} fontFamily={FONT} fontSize={22} fontWeight="700" fill={GOLD} letterSpacing={10}>
      HEALTH
    </SvgText>
    <SvgText x={990} y={y + 64} textAnchor="end" fontFamily={FONT} fontSize={24} fill={SOFT}>
      kuovahealth.com
    </SvgText>
  </>
);

// ===== Encima del QR del fondo de pantalla (fundador, 2026-11-09) =====
// «Un logo encima con el asterisco, como Apple»: el asterisco rojo sobre un círculo blanco es lo que reconoce
// quien atiende una emergencia (en un iPhone en español se llama «Datos médicos»). Nada de cruz roja (emblema
// protegido por ley) ni de la Estrella de la Vida con la serpiente. Es la misma idea, no la de Apple: los brazos
// acaban redondos, va suelto sobre el fondo y el texto lleva la letra de la tarjeta.
const RED = '#E0383E';
const MedicalStar = ({ cx, cy, r, ring }: { cx: number; cy: number; r: number; ring?: string }) => {
  const l = r * 0.54;
  return (
    <>
      <Circle cx={cx} cy={cy} r={r} fill="#FFFFFF" stroke={ring ?? 'none'} strokeOpacity={0.2} strokeWidth={ring ? r * 0.07 : 0} />
      {[90, 30, 150].map((a) => {
        const dx = l * Math.cos((a * Math.PI) / 180);
        const dy = l * Math.sin((a * Math.PI) / 180);
        return <Path key={a} d={`M${cx - dx} ${cy - dy}L${cx + dx} ${cy + dy}`} stroke={RED} strokeWidth={r * 0.27} strokeLinecap="round" />;
      })}
    </>
  );
};
// SVG no mide el texto: ancho aproximado en negrita, por lo alto (Roboto y San Francisco son algo más
// estrechas que Arial); el texto va centrado en su hueco, así que si sobra se reparte a los dos lados
const textW = (s: string, fs: number) => s.length * fs * 0.6;

// Sin fondo (fundador, 2026-11-09: «que no esté dentro del cuadrado, fondo transparente para tapar cuanto
// menos el fondo»; antes se probaron una píldora verde y una tarjeta crema): encima del QR, el asterisco y
// «Datos médicos» y, debajo, «Escanea con la cámara», sueltos sobre el fondo. Para que se lean sobre cualquier
// foto, cada texto lleva debajo un contorno suave: oscuro en los fondos oscuros y en las fotos, crema en los
// claros. El cuadro crema del QR es lo único que tapa; en los fondos claros lleva un filo verde para que se vea.
type Box = { x: number; y: number; size: number };
const HaloText = ({ x, y, fs, weight, text, light }: { x: number; y: number; fs: number; weight: '600' | '700'; text: string; light: boolean }) => (
  <>
    <SvgText x={x} y={y} textAnchor="middle" fontFamily={FONT} fontSize={fs} fontWeight={weight} fill={light ? CREAM : '#000000'} fillOpacity={light ? 0.9 : 0.35} stroke={light ? CREAM : '#000000'} strokeOpacity={light ? 0.9 : 0.35} strokeWidth={fs * 0.18} strokeLinejoin="round">
      {text}
    </SvgText>
    <SvgText x={x} y={y} textAnchor="middle" fontFamily={FONT} fontSize={fs} fontWeight={weight} fill={light ? GREEN_DEEP : '#FFFFFF'}>
      {text}
    </SvgText>
  </>
);
const LockLabel = ({ q, light }: { q: Box; light: boolean }) => {
  const label = t('Medical ID');
  const fs = 46;
  const r = 34;
  const capY = q.y - 30; // «Escanea con la cámara», justo encima del QR
  const cy = capY - 28 - 30 - r; // la fila del asterisco y «Datos médicos»
  const rowW = 2 * r + 20 + textW(label, fs);
  const rx = (EC_W - rowW) / 2;
  return (
    <>
      {light && <Rect x={q.x - 3} y={q.y - 3} width={q.size + 6} height={q.size + 6} rx={q.size * 0.07 + 3} fill="none" stroke={GREEN} strokeOpacity={0.3} strokeWidth={3} />}
      <MedicalStar cx={rx + r} cy={cy} r={r} ring={light ? GREEN : '#000000'} />
      <HaloText x={rx + 2 * r + 20 + textW(label, fs) / 2} y={cy + fs * 0.36} fs={fs} weight="700" text={label} light={light} />
      <HaloText x={EC_W / 2} y={capY} fs={28} weight="600" text={t('Scan with the camera')} light={light} />
    </>
  );
};

export const EmergencyCard = forwardRef<any, { h: Historial; width: number; variant?: CardVariant; photo?: string | null; bg?: LockBg }>(({ h, width, variant = 'full', photo, bg = 'green' }, ref) => {
  const L = cardLayout(h, variant);
  const qrText = emergencyQrText(h, { lock: variant === 'lock' });

  if (variant === 'lock') {
    const q = L.qr;
    const light = lightLockBg(bg);
    return (
      <Svg ref={ref} width={width} height={(width * L.h) / L.w} viewBox={`0 0 ${L.w} ${L.h}`}>
        <LockBackground bg={bg} photo={photo} />
        <LockLabel q={q} light={light} />
        <QrCode text={qrText} {...q} />
      </Svg>
    );
  }

  const names = L.nameLines.map((s, i) => (
    <SvgText key={`n${i}`} x={90} y={L.nameY[i]} fontFamily={FONT} fontSize={variant === 'full' ? 64 : 58} fontWeight="800" fill="#FFFFFF">
      {s}
    </SvgText>
  ));
  return (
    <Svg ref={ref} width={width} height={(width * L.h) / L.w} viewBox={`0 0 ${L.w} ${L.h}`}>
      <Background w={L.w} h={L.h} />
      <Header y={92} text={t('EMERGENCY CARD')} />
      {names}
      {variant === 'full' && L.nameLines.length > 0 && <Rect x={90} y={L.nameY[L.nameY.length - 1] + 56} width={120} height={4} fill={GOLD} />}
      {L.bloodY != null && (
        <>
          <SvgText x={90} y={L.bloodY} fontFamily={FONT} fontSize={28} fontWeight="700" fill={SOFT} letterSpacing={5}>
            {t('Blood group').toUpperCase()}
          </SvgText>
          <SvgText x={90} y={L.bloodY + 100} fontFamily={FONT} fontSize={92} fontWeight="800" fill={GOLD}>
            {L.k.blood}
          </SvgText>
        </>
      )}
      <QrCode text={qrText} {...L.qr} />
      {variant === 'full' && <Sections list={L.sections} label={28} value={44} />}
      <Signature y={L.h - 100} />
    </Svg>
  );
});
EmergencyCard.displayName = 'EmergencyCard';

// El QR solo, grande y sobre blanco, para que lo escaneen directamente de la pantalla
export function BigQr({ h, size, lock }: { h: Historial; size: number; lock?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <QrCode text={emergencyQrText(h, { lock })} x={0} y={0} size={size} fg="#000000" bg="#FFFFFF" radius={0} />
    </Svg>
  );
}
