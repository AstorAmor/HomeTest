import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { featureValue, isIncluded, loadPlanFeatures, Tier, tierName } from '@/data/access';
import { t } from '@/i18n';

// Lo que no va en tu suscripción (escanear informes, el menú semanal…): al entrar sale esta ventana,
// «Suscríbete a Kuova Basic», con qué es y qué trae. Se puede cerrar (botón, fuera o «atrás») y al
// cerrarla vuelves a la pantalla de antes. El nivel que se ofrece es el más barato que lo incluye,
// según la tabla de planes (Más → Suscripciones (admin)).
export const SubscribePopup = ({
  feature,
  icon,
  text,
  fallback = '/(tabs)',
}: {
  feature: string;
  icon: string;
  text: string;
  fallback?: string;
}) => {
  const router = useRouter();
  const [tier, setTier] = useState<Tier>('membership');
  useEffect(() => {
    loadPlanFeatures()
      .then(({ rows }) => setTier((['membership', 'premium'] as Tier[]).find((x) => isIncluded(featureValue(rows, feature, x))) ?? 'membership'))
      .catch(() => undefined);
  }, [feature]);

  const close = () => (router.canGoBack() ? router.back() : router.replace(fallback as any));
  // Se sustituye esta pantalla: al volver de la comparación o del código se vuelve a la de antes
  const go = (path: '/compare-plans' | '/redeem-code') => router.replace(path);
  const plan = `Kuova ${tierName(tier)}`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel={t('Close')}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <View style={styles.icon}>
            <MaterialCommunityIcons name={icon as any} size={26} color={Colors.gold} />
          </View>
          <Text style={styles.title}>{t('Subscribe to {plan}', { plan })}</Text>
          <Text style={styles.text}>{t(text)}</Text>
          <TouchableOpacity style={styles.primary} onPress={() => go('/compare-plans')}>
            <Text style={styles.primaryText}>{t('See subscriptions')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => go('/redeem-code')} hitSlop={8}>
            <Text style={styles.link}>{t('I have a code')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={close}>
            <Text style={styles.secondaryText}>{t('Not now')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, backgroundColor: Colors.background, borderRadius: 20, borderWidth: 1, borderColor: Colors.cardBorder, padding: 22, alignItems: 'center', gap: 10 },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: withAlpha(Colors.gold, 0.14), alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  text: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  primary: { alignSelf: 'stretch', alignItems: 'center', backgroundColor: Colors.accent, borderRadius: 24, paddingVertical: 13, marginTop: 6 },
  primaryText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  link: { color: Colors.accent, fontSize: 14, fontWeight: '700', paddingVertical: 4 },
  secondary: { alignSelf: 'stretch', alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 24, paddingVertical: 12 },
  secondaryText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
});
