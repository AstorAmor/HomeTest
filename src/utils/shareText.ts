import { Share } from 'react-native';

// Móvil: un texto largo (p. ej. el entrenamiento para una IA) al menú de compartir del sistema, que ya trae
// «Copiar», WhatsApp, el correo, ChatGPT, Gemini… Es de React Native, sin módulo nativo nuevo: llega con una
// actualización (EAS Update). La web tiene su versión (shareText.web.ts): lo copia al portapapeles.

export type ShareTextResult = 'shared' | 'copied' | 'dismissed';

export const shareTextCopies = false;

export async function shareText(o: { text: string; title: string; fileName?: string }): Promise<ShareTextResult> {
  const r = await Share.share({ message: o.text, title: o.title }, { dialogTitle: o.title, subject: o.title });
  return r.action === Share.dismissedAction ? 'dismissed' : 'shared';
}
