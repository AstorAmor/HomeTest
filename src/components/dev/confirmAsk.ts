import { Alert, Platform } from 'react-native';
import { t } from '@/i18n';

// Pregunta antes de algo que borra datos (Test scenarios). En la web, el confirm del navegador.
export const confirmAsk = (title: string, message: string, okLabel: string) =>
  Platform.OS === 'web'
    ? Promise.resolve(window.confirm(`${title}\n\n${message}`))
    : new Promise<boolean>((resolve) =>
        Alert.alert(
          title,
          message,
          [
            { text: t('Cancel'), style: 'cancel', onPress: () => resolve(false) },
            { text: okLabel, style: 'destructive', onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) }
        )
      );
