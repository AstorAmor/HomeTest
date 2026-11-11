import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleProp, StyleSheet, Text, TextInput, TextStyle, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/colors';
import { t } from '@/i18n';
import { codeFromInput, codeInText } from '@/logic/mfa';
import { canReadClipboard, readClipboard } from '@/utils/clipboard';

// Casilla del código de 6 cifras: doble factor (alta y al entrar), confirmar el email y «¿Has olvidado tu
// contraseña?». Fundador, 2026-11-11, en un Xiaomi con HyperOS: costaba meter el código y no dejaba pegar.
// - Sin maxLength: Android corta lo pegado ANTES de limpiarlo («Código: 482 913» se quedaba en «Código»).
//   La casilla se queda con el código (codeFromInput): acepta espacios, guiones y texto alrededor.
// - «Pegar el código»: el teclado numérico de muchos Android no tiene portapapeles.
// - Android: al volver a Kuova (p. ej. desde la app de autenticación) con un código copiado y la casilla
//   vacía, «Usar 482 913 (copiado)». Solo al volver, no al abrir la pantalla: Android avisa cada vez que una
//   app lee lo copiado. En iPhone no se lee solo (pediría permiso); queda el botón.
// - Al llegar a 6 cifras se envía solo (onComplete), una vez por código.

type Props = {
  value: string;
  onChange: (code: string) => void;
  onComplete: (code: string) => void;
  editable?: boolean;
  autoFocus?: boolean;
  style?: StyleProp<TextStyle>;
};

const pretty = (c: string) => `${c.slice(0, 3)} ${c.slice(3)}`;
const SUGGEST_ON_RETURN = Platform.OS === 'android';
// Android solo deja leer lo copiado con la app ya delante
const RETURN_DELAY_MS = 500;

export function CodeInput({ value, onChange, onComplete, editable = true, autoFocus, style }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const canPaste = canReadClipboard();
  const live = useRef(true);
  const empty = useRef(value.length === 0);
  empty.current = value.length === 0;
  useEffect(
    () => () => {
      live.current = false;
    },
    []
  );

  const set = (next: string) => {
    setNote('');
    setCopied(null);
    onChange(next);
    if (next.length === 6 && next !== value) onComplete(next);
  };

  useEffect(() => {
    if (!SUGGEST_ON_RETURN || !canPaste || !editable) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' || !empty.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const code = codeInText(await readClipboard());
        if (live.current && empty.current) setCopied(code);
      }, RETURN_DELAY_MS);
    });
    return () => {
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, [canPaste, editable]);

  const paste = async () => {
    const code = codeInText(await readClipboard());
    if (!live.current) return;
    if (code) set(code);
    else setNote(t('There is no 6-digit code copied. Copy it in the other app and try again.'));
  };

  return (
    <View>
      <TextInput
        style={style}
        value={value}
        onChangeText={(v) => set(codeFromInput(v))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        placeholder="123456"
        placeholderTextColor={Colors.textMuted}
        editable={editable}
        autoFocus={autoFocus}
        contextMenuHidden={false}
        onSubmitEditing={() => value.length === 6 && onComplete(value)}
        accessibilityLabel={t('6-digit code')}
      />
      {copied && value.length === 0 && editable ? (
        <TouchableOpacity style={styles.suggest} onPress={() => set(copied)} activeOpacity={0.85}>
          <Ionicons name="clipboard-outline" size={16} color={Colors.background} />
          <Text style={styles.suggestText}>{t('Use {code} (copied)', { code: pretty(copied) })}</Text>
        </TouchableOpacity>
      ) : canPaste && editable ? (
        <TouchableOpacity style={styles.paste} onPress={paste} hitSlop={8} accessibilityRole="button">
          <Ionicons name="clipboard-outline" size={16} color={Colors.accent} />
          <Text style={styles.pasteText}>{t('Paste the code')}</Text>
        </TouchableOpacity>
      ) : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  paste: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 6, marginTop: 10, paddingVertical: 4 },
  pasteText: { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  suggest: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: withAlpha(Colors.accent, 0.9),
  },
  suggestText: { color: Colors.background, fontSize: 15, fontWeight: '700' },
  note: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 },
});
