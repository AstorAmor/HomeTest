import { Share } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';
import { CARD_H, CARD_W } from '@/components/badges/BadgeShareCard';

// Móvil: la tarjeta SVG de la insignia se convierte en PNG (toDataURL de react-native-svg) y se
// abre el menú de compartir del sistema → Instagram, WhatsApp, TikTok… La web tiene su versión
// (shareBadge.web.ts). Sin expo-sharing (APK anterior al 2026-10-07) se comparte como texto.

export interface BadgeShare {
  svg: any; // ref del <Svg> de BadgeShareCard
  domId: string; // solo web
  fileName: string;
  message: string;
}

const sharingModule = (): typeof import('expo-sharing') | null => {
  if (!requireOptionalNativeModule('ExpoSharing')) return null;
  try {
    return require('expo-sharing');
  } catch {
    return null;
  }
};

export async function shareBadge({ svg, fileName, message }: BadgeShare): Promise<void> {
  const Sharing = sharingModule();
  if (Sharing && svg?.toDataURL && FileSystem.cacheDirectory) {
    try {
      const data: string = await new Promise((resolve) => svg.toDataURL(resolve, { width: CARD_W, height: CARD_H }));
      const uri = `${FileSystem.cacheDirectory}${fileName}.png`;
      await FileSystem.writeAsStringAsync(uri, data.replace(/^data:image\/png;base64,/, ''), {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: message });
        return;
      }
    } catch {
      // Si la imagen falla, al menos el texto
    }
  }
  await Share.share({ message });
}
