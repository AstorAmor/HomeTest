import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProLayout } from '@/components/pro/ProLayout';
import { PreferencesBlock } from '@/components/PreferencesBlock';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useLogout } from '@/hooks/useLogout';
import { t } from '@/i18n';

// Ajustes del portal del médico: apariencia, idioma y tamaño de letra (lo mismo que en la app) y
// salir. El perfil profesional (datos, contacto, canales, agenda) sigue en "Profile".
export const ProPreferencesScreen = () => {
  const { demoMode } = useAuth();
  const exit = useLogout();
  return (
    <ProLayout active="preferences" title={t('Settings')}>
      <PreferencesBlock returnTo="/pro-preferences" />
      <TouchableOpacity style={styles.exit} onPress={exit}>
        <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
        <Text style={styles.exitText}>{demoMode === 'pro' ? t('Exit demo portal') : t('Log out')}</Text>
      </TouchableOpacity>
    </ProLayout>
  );
};

const styles = StyleSheet.create({
  exit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28, paddingVertical: 12 },
  exitText: { color: Colors.danger, fontSize: 15, fontWeight: '700' },
});
