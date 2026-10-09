import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { ProgressRing } from '@/components/ProgressRing';
import { TrendChart } from '@/components/TrendChart';
import { CycleStrip } from '@/components/CycleStrip';
import { BristolShape } from '@/components/BathroomVisuals';
import { currentCyclePhase } from '@/utils/cyclePhase';
import { AppSection } from '@/data/appPrefs';

// Vista previa de cada parte de la app (con datos de ejemplo), para que se vea cómo quedará antes
// de encenderla. Usa los mismos componentes que la pantalla real cuando se puede.
export const FeaturePreview = ({ section }: { section: AppSection }) => (
  <View style={styles.frame}>
    <Text style={styles.tag}>Preview</Text>
    {previews()[section]}
  </View>
);

const Row = ({ icon, title, sub, right }: { icon: React.ReactNode; title: string; sub: string; right?: React.ReactNode }) => (
  <View style={styles.row}>
    <View style={styles.rowIcon}>{icon}</View>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowSub}>{sub}</Text>
    </View>
    {right}
  </View>
);

const Bar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <View style={{ gap: 4 }}>
    <Text style={styles.rowTitle}>{label}</Text>
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${value * 100}%`, backgroundColor: color }]} />
    </View>
  </View>
);

const Pill = ({ text }: { text: string }) => (
  <View style={styles.pill}>
    <Text style={styles.pillText}>{text}</Text>
  </View>
);

// Se construye al pintar (no al cargar el módulo): así ya existen los estilos y el tema
const previews = (): Record<AppSection, React.ReactNode> => ({
  plan: (
    <View style={{ gap: 10 }}>
      <Bar label="Hit 3 days of strength training" value={0.66} color={Colors.coral} />
      <Bar label="Walk 8,000 steps a day" value={0.85} color={Colors.sky} />
      <Bar label="Reduce added sugar" value={0.4} color={Colors.amber} />
    </View>
  ),
  checkin: (
    <Row
      icon={
        <Svg width={36} height={36}>
          <Defs>
            <RadialGradient id="pv-orb" cx="34%" cy="28%" r="78%">
              <Stop offset="0" stopColor="#F3E2B8" />
              <Stop offset="0.25" stopColor={Colors.gold} />
              <Stop offset="0.6" stopColor={Colors.green} />
              <Stop offset="1" stopColor="#0E2A24" />
            </RadialGradient>
          </Defs>
          <Circle cx={18} cy={18} r={17} fill="url(#pv-orb)" />
        </Svg>
      }
      title="How are you feeling?"
      sub="🤩 Excited · 😊 Happy · 😌 Calm · 😔 Sad"
      right={<Pill text="Check in" />}
    />
  ),
  readiness: (
    <View style={{ alignItems: 'center' }}>
      <ProgressRing size={96} strokeWidth={9} progress={0.72} color={Colors.green} gradient={[Colors.coral, Colors.gold, Colors.green]}>
        <Text style={styles.big}>72</Text>
      </ProgressRing>
      <Text style={styles.rowSub}>Ready for a normal day</Text>
    </View>
  ),
  wearables: (
    <TrendChart
      height={70}
      labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
      series={[{ label: 'Sleep (h)', color: Colors.violet, values: [7.1, 6.4, 7.8, 6.9, 7.3, 8.1, 7.6] }]}
      formatY={(v) => v.toFixed(0)}
    />
  ),
  cycle: <CycleStrip info={currentCyclePhase([])} />,
  digestive: (
    <View style={{ gap: 10 }}>
      <View style={styles.week}>
        {[1, 2, 1, 0, 1, 1, 2].map((n, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: n ? '#7A5134' : Colors.divider }]}>
            <Text style={[styles.dotText, n ? { color: '#FFFFFF' } : null]}>{n}</Text>
          </View>
        ))}
      </View>
      <View style={styles.shapes}>
        {([1, 3, 4, 6] as const).map((t) => (
          <BristolShape key={t} type={t} size={34} />
        ))}
      </View>
      <Row
        icon={<Ionicons name="checkmark-circle" size={18} color={Colors.ok} />}
        title="Your digestion looks regular"
        sub="Frequency, colour and consistency are within the usual range."
      />
    </View>
  ),
  medication: (
    <View style={{ gap: 8 }}>
      <Row
        icon={<Ionicons name="medical-outline" size={16} color={Colors.gold} />}
        title="07:30 · Levothyroxine"
        sub="50 µg · empty stomach"
        right={<Ionicons name="checkmark-circle" size={18} color={Colors.ok} />}
      />
      <Row
        icon={<Ionicons name="leaf-outline" size={16} color={Colors.green} />}
        title="21:30 · Magnesium"
        sub="300 mg"
        right={<Pill text="Taken" />}
      />
    </View>
  ),
  badges: (
    <View style={styles.shapes}>
      {(['footsteps', 'trophy', 'happy', 'leaf'] as const).map((icon) => (
        <View key={icon} style={styles.badge}>
          <Ionicons name={icon} size={20} color={Colors.amber} />
        </View>
      ))}
    </View>
  ),
  specialists: (
    <Row
      icon={<Ionicons name="medkit-outline" size={16} color={Colors.accent} />}
      title="Talk to a dietitian"
      sub="Your ferritin is low: a dietitian can help with iron-rich meals."
    />
  ),
  learning: (
    <Row
      icon={<MaterialCommunityIcons name="book-open-variant" size={16} color={Colors.accent} />}
      title="What is HbA1c?"
      sub="Your average blood sugar over about 3 months. 3 min read"
    />
  ),
});

const styles = StyleSheet.create({
  frame: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 18,
    padding: 14,
    paddingTop: 26,
  },
  tag: {
    position: 'absolute',
    top: 8,
    left: 12,
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 10,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  rowSub: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  track: { height: 6, borderRadius: 3, backgroundColor: Colors.divider, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  pill: { backgroundColor: Colors.accent, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { color: Colors.background, fontSize: 11, fontWeight: '800' },
  big: { color: Colors.textPrimary, fontSize: 26, fontWeight: '800' },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800' },
  shapes: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  badge: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
});
