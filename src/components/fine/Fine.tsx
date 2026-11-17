// Piezas del lenguaje fino del prototipo (src/theme/fine.ts): título de pestaña, cabecera de sección, fila con
// línea fina, píldora y candado. Las usan Hoy, Plan, Análisis y Tú.
import type { ReactNode } from 'react';
import { Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FINE, fine } from '@/theme/fine';
import { t } from '@/i18n';

export function TabHead({ title, lead, right }: { title: string; lead?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 8 }}>
      <View style={{ flex: 1 }}>
        <Text style={fine.title} accessibilityRole="header">
          {title}
        </Text>
        {lead ? <Text style={fine.lead}>{lead}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SecHead({
  title,
  more,
  onMore,
  onPress,
  style,
}: {
  title: string;
  more?: string;
  onMore?: () => void;
  onPress?: () => void; // toda la cabecera (título y enlace) abre lo mismo, p. ej. «Tu último informe» → el informe
  style?: StyleProp<ViewStyle>;
}) {
  if (onPress) {
    return (
      <TouchableOpacity style={[fine.secHead, style]} onPress={onPress} activeOpacity={0.7} accessibilityRole="link" accessibilityLabel={more ? `${title}. ${more}` : title}>
        <Text style={fine.secTitle}>{title}</Text>
        <Text style={[fine.secMore, { marginLeft: 'auto' }]}>{more ? `${more} ›` : '›'}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={[fine.secHead, style]}>
      <Text style={fine.secTitle} accessibilityRole="header">
        {title}
      </Text>
      {more && onMore ? (
        <TouchableOpacity onPress={onMore} hitSlop={10} style={{ marginLeft: 'auto' }} accessibilityRole="link">
          <Text style={fine.secMore}>{more} ›</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function Chev() {
  return <Ionicons name="chevron-forward" size={15} color={FINE.mute} />;
}

// Candado de la suscripción: «Suscripción» con borde de oro
export function LockTag() {
  return (
    <View style={[fine.tag, { borderColor: 'rgba(216,185,120,0.45)' }]} accessibilityLabel={t('Comes with a subscription')}>
      <Ionicons name="lock-closed-outline" size={10} color={FINE.gold} />
      <Text style={[fine.tagText, { color: FINE.gold }]}>{t('Subscription')}</Text>
    </View>
  );
}

export function Tag({ label, gold }: { label: string; gold?: boolean }) {
  const c = gold ? FINE.gold : FINE.jade;
  return (
    <View style={[fine.tag, { borderColor: gold ? 'rgba(216,185,120,0.45)' : FINE.jadeLine }]}>
      <Text style={[fine.tagText, { color: c }]}>{label}</Text>
    </View>
  );
}

type RowProps = {
  title: string;
  sub?: string;
  value?: string;
  right?: ReactNode; // en lugar del valor y la flecha
  onPress?: () => void;
  last?: boolean; // sin línea debajo
  style?: StyleProp<ViewStyle>;
};

export function FRow({ title, sub, value, right, onPress, last, style }: RowProps) {
  const inner = (
    <>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={fine.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        {sub ? <Text style={fine.rowSub}>{sub}</Text> : null}
      </View>
      {right ?? (
        <>
          {value ? (
            <Text style={fine.rowValue} numberOfLines={1}>
              {value}
            </Text>
          ) : null}
          {onPress ? <Chev /> : null}
        </>
      )}
    </>
  );
  const s = [fine.row, last && { borderBottomWidth: 0 }, style];
  // Con algo pulsable a la derecha (la píldora «Tomada» de las tomas de Hoy), la fila entera no puede ser un botón:
  // en la web un botón no puede llevar otro dentro. Abre el texto; lo de la derecha va aparte
  if (onPress && right) {
    return (
      <View style={s}>
        <TouchableOpacity style={{ flex: 1, minWidth: 0, alignSelf: 'stretch', justifyContent: 'center' }} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
          <Text style={fine.rowTitle} numberOfLines={2}>
            {title}
          </Text>
          {sub ? <Text style={fine.rowSub}>{sub}</Text> : null}
        </TouchableOpacity>
        {right}
      </View>
    );
  }
  return onPress ? (
    <TouchableOpacity style={s} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      {inner}
    </TouchableOpacity>
  ) : (
    <View style={s}>{inner}</View>
  );
}

export function Pill({ label, onPress, gold }: { label: string; onPress: () => void; gold?: boolean }) {
  return (
    <TouchableOpacity style={[fine.pill, gold && fine.pillGold]} onPress={onPress} activeOpacity={0.8} accessibilityRole="button">
      <Text style={[fine.pillText, gold && fine.pillGoldText]}>{label}</Text>
    </TouchableOpacity>
  );
}
