import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, StyleProp, TextStyle, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { t } from '@/i18n';

// Campo de contraseña con el ojo para verla mientras se escribe
export const PasswordInput = ({ style, ...props }: Omit<TextInputProps, 'secureTextEntry'> & { style?: StyleProp<TextStyle> }) => {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.wrap}>
      <TextInput
        {...props}
        style={[style, styles.input]}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity
        style={styles.eye}
        onPress={() => setVisible((v) => !v)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={visible ? t('Hide password') : t('Show password')}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center' },
  input: { paddingRight: 46 },
  eye: { position: 'absolute', right: 12, padding: 4 },
});
