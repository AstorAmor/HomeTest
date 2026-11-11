import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { PASSWORD_RULES, passwordRuleMet, type PasswordRule } from '@/logic/password';
import { t } from '@/i18n';

// Reglas de la contraseña (las mismas que Supabase: config.toml y logic/password.ts), con su ✓ según se
// escribe. En «Crear cuenta» y en «Elige una contraseña nueva».
const RULE_LABEL: Record<PasswordRule, string> = {
  length: 'At least 8 characters',
  letter: 'One letter (a-z)',
  digit: 'One number',
};

export const PasswordRules = ({ password }: { password: string }) => (
  <View style={styles.rules}>
    {PASSWORD_RULES.map((r) => {
      const ok = passwordRuleMet(r, password);
      return (
        <View key={r} style={styles.rule}>
          <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={ok ? Colors.ok : Colors.textMuted} />
          <Text style={[styles.ruleText, ok && styles.ruleTextOk]}>{t(RULE_LABEL[r])}</Text>
        </View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  rules: { marginTop: 8, gap: 4, paddingHorizontal: 4 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleText: { color: Colors.textMuted, fontSize: 13 },
  ruleTextOk: { color: Colors.textPrimary },
});
