import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { t } from '@/i18n';
import { TourTarget } from '@/components/tour/TourTarget';
import { K_PATH } from '@/components/LaunchIntro';
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

// «Apuntar» (el botón K): cada cosa lleva a su pantalla de apuntar, que ya existe
const LOG_ITEMS: { label: string; to: Href }[] = [
  { label: 'Check-in', to: '/check-in' },
  { label: 'Weight', to: '/log-weight' },
  { label: 'Blood pressure', to: '/log-blood-pressure' },
  { label: 'Glucose', to: '/log-glucose' },
  { label: 'Water', to: '/log-water' },
  { label: 'Meal', to: '/log-meal' },
  { label: 'Workout', to: '/log-workout' },
  { label: 'Dose', to: '/medications' },
  // Digestión, heces y orina (fundador, 2026-11-16: «faltaría también orina y heces, digestión»)
  { label: 'Digestion', to: '/log-digestion' },
  { label: 'Stools', to: '/log-bowel' },
  { label: 'Urine', to: '/log-urine' },
  { label: 'Report', to: '/upload-test' },
];

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

// La hoja «Apuntar»: todo lo que se puede registrar, en tres columnas
function LogSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 14 }]} onPress={() => undefined}>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            {t('Log')}
          </Text>
          <Text style={[fine.lead, { marginBottom: 14 }]}>{t('Everything you can record, in one place.')}</Text>
          <View style={styles.grid}>
            {LOG_ITEMS.map((it) => (
              <TouchableOpacity
                key={it.label}
                style={styles.cell}
                activeOpacity={0.75}
                onPress={() => {
                  onClose();
                  router.push(it.to);
                }}
              >
                <Text style={styles.cellText} numberOfLines={2}>
                  {t(it.label)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
  },
  sheetTitle: { ...ff('medium'), fontSize: 20, color: FINE.ivory },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    width: '31.8%',
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FINE.line,
    backgroundColor: FINE.tile,
  },
  cellText: { ...ff('regular'), fontSize: 14, lineHeight: 18, color: FINE.ivory, textAlign: 'center' },
  close: { alignSelf: 'flex-start', marginTop: 16, minHeight: 32, justifyContent: 'center' },
});
