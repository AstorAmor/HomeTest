import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { UserAvatar } from './UserAvatar';
import { useIsShellRoot } from './web/WebShell';
import { FINE, INTER } from '@/theme/fine';
import { t } from '@/i18n';


interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
  // La foto solo sale en Today (pidió el fundador); en el resto, el hueco queda vacío
  showAvatar?: boolean;
  // A dónde volver si no hay pantalla anterior (p. ej. tras recargar por cambiar el tema)
  backFallback?: string;
  // Un botón a la derecha (p. ej. compartir en el Historial de entrenos)
  right?: React.ReactNode;
}

export const ScreenHeader = ({ title, showBack = false, showAvatar = false, backFallback = '/', right }: ScreenHeaderProps) => {
  const router = useRouter();
  // En la web de escritorio, las entradas del menú lateral no llevan "atrás"
  const shellRoot = useIsShellRoot();
  const back = showBack && !shellRoot;

  // Como en el prototipo (borradores/app-estructura/prototipo, 2026-11-16): «‹» en jade y el título a la izquierda,
  // en Inter de peso medio, sin negrita (el fundador: «los submenús siguen con fuente negrita súper gorda»)
  return (
    <View style={styles.header}>
      {back ? (
        <TouchableOpacity
          style={styles.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(backFallback as any))}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('Back')}
        >
          <Ionicons name="chevron-back" size={24} color={FINE.jade} />
        </TouchableOpacity>
      ) : null}

      <Text style={[styles.title, !back && styles.titleAlone]} numberOfLines={2} accessibilityRole="header">
        {title}
      </Text>

      {right ?? (showAvatar && !shellRoot ? <UserAvatar size={38} /> : null)}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 10,
    paddingRight: 20,
    paddingTop: 6,
    paddingBottom: 12,
    minHeight: 56,
  },
  back: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: INTER.medium, fontSize: 19, lineHeight: 24, color: FINE.ivory },
  titleAlone: { paddingLeft: 10 },
});
