// «Empieza por tu primer análisis» (2026-11-16): sin ningún análisis todavía. En Análisis es la cabecera, con
// sus dos botones; en Hoy, «Lo siguiente», con «Ver» (lleva a Análisis) y una × para cerrarla. Con el lenguaje
// fino del prototipo (src/theme/fine.ts).
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { goToTab, TAB } from '@/constants/tabs';
import { Pill } from '@/components/fine/Fine';
import { FINE, ff, fine } from '@/theme/fine';
import { t } from '@/i18n';

export function FirstAnalysisCard({ variant, onClose }: { variant: 'analysis' | 'today'; onClose?: () => void }) {
  const router = useRouter();
  if (variant === 'today') {
    return (
      <View style={styles.next}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={fine.kicker}>{t('Up next')}</Text>
          <Text style={styles.title}>{t('Start with your first test')}</Text>
          <Text style={styles.sub}>{t('Choose one, or answer 4 questions and we suggest one.')}</Text>
        </View>
        <Pill label={t('See')} onPress={() => goToTab(TAB.analysis)} />
        {onClose && (
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel={t('Close')} style={styles.close}>
            <Ionicons name="close" size={17} color={FINE.mute} />
          </TouchableOpacity>
        )}
      </View>
    );
  }
  return (
    <View style={styles.hero}>
      <Text style={styles.heroTitle}>{t('Start with your first test')}</Text>
      <Text style={styles.heroText}>{t('A blood draw at a lab near you. Then you will see your biomarkers, your KUOVA age and when to repeat it here.')}</Text>
      <View style={styles.actions}>
        <Pill label={t('See tests')} onPress={() => router.push('/store')} />
        {/* Subir uno que ya tienes va en Tus archivos (fundador, 2026-11-16) */}
        <Pill gold label={t('Not sure which one?')} onPress={() => router.push('/test-finder')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // «Lo siguiente» en Hoy: una tarjeta casi transparente con su píldora
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FINE.line,
    backgroundColor: 'rgba(240,239,230,0.05)',
  },
  title: { ...ff('medium'), color: FINE.ivory, fontSize: 15, marginTop: 2 },
  sub: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  close: { alignSelf: 'flex-start', marginLeft: -4 },
  // Cabecera de Análisis sin ningún análisis: sin caja
  hero: { paddingTop: 22, paddingBottom: 6 },
  heroTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  heroText: { ...ff('regular'), color: FINE.mute, fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
});
