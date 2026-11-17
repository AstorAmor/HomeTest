import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { t } from '@/i18n';
import { TourTarget } from '@/components/tour/TourTarget';
import { K_PATH } from '@/components/LaunchIntro';
import { DumbbellIcon } from '@/components/fine/DumbbellIcon';
import { PathIcon } from '@/components/fine/RoleEmblem';
import { FINE, ff, fine } from '@/theme/fine';

type TabId = 'today' | 'plan' | 'analysis' | 'you';
interface TabConfig {
  id: TabId;
  label: string;
}

// Orden de las pestañas (también el de MainTabsScreen y el ?tab=N de la URL; posiciones en
// src/constants/tabs.ts). Desde el 2026-11-16: Hoy · Plan · (K) · Análisis · Tú.
export const TABS: TabConfig[] = [
  { id: 'today', label: 'Today' },
  { id: 'plan', label: 'Plan' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'you', label: 'You' },
];

// Iconos de trazo fino, los del prototipo (24×24, trazo 1,6): sol, lista con visto, matraz y persona
function TabIcon({ id, color }: { id: TabId; color: string }) {
  const p = { stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {id === 'today' && (
        <>
          <Circle cx={12} cy={12} r={4} {...p} />
          <Path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" {...p} />
        </>
      )}
      {id === 'plan' && <Path d="M4 6h10M4 12h10M4 18h6M15.5 17l2 2 3.5-4.5" {...p} />}
      {id === 'analysis' && <Path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7.5 15h9" {...p} />}
      {id === 'you' && (
        <>
          <Circle cx={12} cy={8} r={4} {...p} />
          <Path d="M4 21c1.5-4 5-5 8-5s6.5 1 8 5" {...p} />
        </>
      )}
    </Svg>
  );
}

// Un dibujo a línea por cada cosa que se apunta (fundador, 2026-11-17: «cuando pinchas la K… la estética no es
// coherente en los iconos» y «sé coherente con los iconos»): todos del mismo trazo fino, a 24 × 24 y solo línea,
// como los de las pestañas y los de fine/ (se pintan con PathIcon, el de los dibujos de los especialistas). Los que
// ya existían en la app son el mismo dibujo: la cara del check-in y la báscula (fine/GoalEmblem), el corazón con
// pulso, el vaso y la manzana (fine/LineEmblem), la gota con el terrón de la glucosa (HealthIcons) y el intestino
// (IntestineIcon). Las pesas no van aquí: son el dibujo único de fine/DumbbellIcon.
const LOG_PATHS = {
  symptom: 'M10 13.6V5a2 2 0 0 1 4 0v8.6a3.9 3.9 0 1 1-4 0zM12 9.5v7.2',
  checkin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.6 14.2q3.4 3 6.8 0M9.2 9.6h.01M14.8 9.6h.01',
  weight: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8.5 10.5a3.5 3.5 0 0 1 7 0M12 10.5l1.6-1.8',
  pressure: 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20zM7 12h2.6l1.4-2.4 2.2 4.4 1.3-2h2.5',
  glucose:
    'M10 2.8C8 5.4 4.8 9.4 4.8 12.6c0 2.9 2.3 5.2 5.2 5.2.4 0 .8 0 1.2-.1M10 2.8c2 2.6 5.2 6.6 5.2 9.8M14.2 13.6l3.4-1.6 3.4 1.6v4l-3.4 1.7-3.4-1.7zM14.2 13.6l3.4 1.6 3.4-1.6M17.6 15.2v4.1',
  water: 'M6 3.5h12l-1.6 16a1.7 1.7 0 0 1-1.7 1.5H9.3a1.7 1.7 0 0 1-1.7-1.5L6 3.5zM6.8 10c1.7-.9 3.5-.9 5.2 0s3.5.9 5.2 0',
  meal: 'M12 7.5c-1.4-1-3.8-1.3-5.3.3C4.9 9.6 5.2 13.4 6.6 16.3 7.8 18.8 9.6 20.6 11.2 20c.5-.2.6-.3.8-.3s.3.1.8.3c1.6.6 3.4-1.2 4.6-3.7 1.4-2.9 1.7-6.7-.1-8.5-1.5-1.6-3.9-1.3-5.3-.3zM12 7.5c0-2 .8-3.5 2.6-4.3M12 6.5c-1.5-.2-2.8-1.2-3.2-2.8 1.6-.2 2.9.7 3.2 2.8z',
  dose: 'M4.9 13.3l8.4-8.4a4.1 4.1 0 0 1 5.8 5.8l-8.4 8.4a4.1 4.1 0 0 1-5.8-5.8zM9.1 9.1l5.8 5.8',
  digestion:
    'M12.5 1.5V3A1.5 1.5 0 0 1 11 4.5H7.5A2.5 2.5 0 0 0 7.5 9.5H15.4M10.6 7H17.7A2.5 2.5 0 0 1 17.7 12H6.3A2.5 2.5 0 0 0 6.3 17H14.1M8.6 14.5H17.1A2.5 2.5 0 0 1 17.1 19.5H12.9A1.5 1.5 0 0 0 11.4 21V22.5',
  stools: 'M9 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM9 9h.01M9 4h8a3 3 0 0 1 3 3v12.5h-7V13',
  urine: 'M12 3.2c-3.1 3.8-5.6 7.1-5.6 10.3a5.6 5.6 0 0 0 11.2 0c0-3.2-2.5-6.5-5.6-10.3z',
  report: 'M7 3.5h7l4 4V20.5H7zM14 3.5v4h4M9.8 12.5h4.4M9.8 16h4.4',
} as const;
type LogIcon = keyof typeof LOG_PATHS | 'weights';

// «Apuntar» (el botón K): cada cosa lleva a su pantalla de apuntar, que ya existe
const LOG_ITEMS: { label: string; to: Href; icon: LogIcon }[] = [
  // Lo primero, el diario de síntomas (fundador, 2026-11-17: «quiero añadir al principio una opción que sea "Síntoma"»)
  { label: 'Symptom', to: '/log-symptom', icon: 'symptom' },
  { label: 'Check-in', to: '/check-in', icon: 'checkin' },
  { label: 'Weight', to: '/log-weight', icon: 'weight' },
  { label: 'Blood pressure', to: '/log-blood-pressure', icon: 'pressure' },
  { label: 'Glucose', to: '/log-glucose', icon: 'glucose' },
  { label: 'Water', to: '/log-water', icon: 'water' },
  { label: 'Meal', to: '/log-meal', icon: 'meal' },
  // Las pesas del entrenador personal y de la racha de fuerza
  { label: 'Workout', to: '/log-workout', icon: 'weights' },
  { label: 'Dose', to: '/medications', icon: 'dose' },
  // Digestión, heces y orina (fundador, 2026-11-16: «faltaría también orina y heces, digestión»)
  { label: 'Digestion', to: '/log-digestion', icon: 'digestion' },
  { label: 'Stools', to: '/log-bowel', icon: 'stools' },
  { label: 'Urine', to: '/log-urine', icon: 'urine' },
  { label: 'Report', to: '/upload-test', icon: 'report' },
];

// El dibujo de una opción, en jade y con el trazo fino de los dibujos de fine/ (1,3 px)
const GLYPH = 22;
function LogGlyph({ icon }: { icon: LogIcon }) {
  return icon === 'weights' ? <DumbbellIcon size={GLYPH} color={FINE.jade} /> : <PathIcon d={LOG_PATHS[icon]} size={GLYPH} color={FINE.jade} />;
}

interface BottomTabBarProps {
  currentIndex: number;
  onTabPress: (index: number) => void;
}

export const BottomTabBar = ({ currentIndex, onTabPress }: BottomTabBarProps) => {
  const [logOpen, setLogOpen] = useState(false);
  const tab = (index: number) => {
    const cfg = TABS[index];
    const isActive = index === currentIndex;
    const color = isActive ? FINE.jade : FINE.mute;
    return (
      <TourTarget key={cfg.id} id={`tab.${index}`} style={styles.tabSlot}>
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => onTabPress(index)}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityState={{ selected: isActive }}
        >
          <TabIcon id={cfg.id} color={color} />
          <Text style={[styles.label, { color }]}>{t(cfg.label)}</Text>
        </TouchableOpacity>
      </TourTarget>
    );
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.tabBar}>
        {tab(0)}
        {tab(1)}
        <TourTarget id="tab.log" style={styles.kSlot}>
          <TouchableOpacity style={styles.kButton} onPress={() => setLogOpen(true)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('Log')}>
            <KButtonFace />
          </TouchableOpacity>
        </TourTarget>
        {tab(2)}
        {tab(3)}
      </View>
      <LogSheet visible={logOpen} onClose={() => setLogOpen(false)} />
    </SafeAreaView>
  );
};

// El botón K del prototipo: esmeralda con luz arriba a la izquierda, borde de oro fino y la K en oro
const K_SIZE = 58;
function KButtonFace() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width={K_SIZE} height={K_SIZE}>
        <Defs>
          <RadialGradient id="tabKBg" cx="35%" cy="30%" r="75%">
            <Stop offset="0" stopColor="#1E7A5D" />
            <Stop offset="1" stopColor="#0B2921" />
          </RadialGradient>
        </Defs>
        <Circle cx={K_SIZE / 2} cy={K_SIZE / 2} r={K_SIZE / 2 - 0.5} fill="url(#tabKBg)" stroke="rgba(216,185,120,0.5)" strokeWidth={1} />
      </Svg>
      <View style={styles.kMark}>
        <Svg width={22} height={(22 * 257) / 260} viewBox="0 0 260 257">
          <Path d={K_PATH} fill={FINE.gold} />
        </Svg>
      </View>
    </View>
  );
}

// La hoja «Apuntar»: todo lo que se puede registrar, en tres columnas, cada cosa con su dibujo a línea encima del
// nombre. En un móvil bajo (o con la letra grande) la rejilla se desplaza dentro de la hoja.
const GRID_GAP = 8;

function LogSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [gridW, setGridW] = useState(0);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 14 }]} onPress={() => undefined}>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            {t('Log')}
          </Text>
          <Text style={[fine.lead, { marginBottom: 14 }]}>{t('Everything you can record, in one place.')}</Text>
          {/* Tres por fila: el ancho de cada casilla sale del ancho medido de la rejilla (con un porcentaje, el
              redondeo dejaba dos por fila en un móvil de 375 px) */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            bounces={false}
            onLayout={(e) => setGridW(e.nativeEvent.layout.width)}
          >
            {LOG_ITEMS.map((it) => (
              <TouchableOpacity
                key={it.label}
                style={[styles.cell, gridW > 0 && { width: Math.floor((gridW - 2 * GRID_GAP) / 3) }]}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t(it.label)}
                onPress={() => {
                  onClose();
                  router.push(it.to);
                }}
              >
                <LogGlyph icon={it.icon} />
                <Text style={styles.cellText} numberOfLines={2}>
                  {t(it.label)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close} accessibilityRole="button">
            <Text style={fine.link}>{t('Close')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: 'rgba(6,26,22,0.94)',
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: FINE.line,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  // El reparto del ancho lo hace el hueco del tutorial; el botón, sin flex (dentro de una columna,
  // flex: 1 lo dejaba con altura 0 en Android y la barra desaparecía)
  tabSlot: { flex: 1 },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    minHeight: 46,
  },
  label: { ...ff('regular'), fontSize: 11 },
  kSlot: { width: 66, alignItems: 'center' },
  kButton: {
    width: K_SIZE,
    height: K_SIZE,
    borderRadius: K_SIZE / 2,
    marginTop: -24,
    marginBottom: 2,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  kMark: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0A2019',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: FINE.line,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '92%',
  },
  sheetTitle: { ...ff('medium'), fontSize: 20, color: FINE.ivory },
  // La rejilla ocupa lo suyo; solo si la hoja no cabe se encoge y se desplaza
  scroll: { flexGrow: 0, flexShrink: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  cell: {
    width: '31%',
    minHeight: 74,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FINE.line,
    backgroundColor: FINE.tile,
  },
  cellText: { ...ff('regular'), fontSize: 13, lineHeight: 17, color: FINE.ivory, textAlign: 'center' },
  close: { alignSelf: 'flex-start', marginTop: 16, minHeight: 32, justifyContent: 'center' },
});
