import { Share } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';

// Móvil: convierte un HTML en PDF (expo-print) y abre el menú de compartir del sistema (expo-sharing),
// como el PDF del plan (sharePlan.ts). Si la APK no lleva esos módulos, se comparte el texto.
// La web tiene su versión (shareHtml.web.ts): diálogo de imprimir / guardar como PDF.

type PrintModule = typeof import('expo-print');
type SharingModule = typeof import('expo-sharing');

function loadNative(): { Print: PrintModule; Sharing: SharingModule } | null {
  if (!requireOptionalNativeModule('ExpoPrint') || !requireOptionalNativeModule('ExpoSharing')) return null;
  try {
    return { Print: require('expo-print'), Sharing: require('expo-sharing') };
  } catch {
    return null;
  }
}

const PAGE = { width: 595, height: 842, margins: { left: 34, right: 34, top: 40, bottom: 40 } };

export async function shareHtmlPdf(o: { html: string; fileName: string; fallbackText: string; dialogTitle: string }): Promise<void> {
  const native = loadNative();
  if (!native || !(await native.Sharing.isAvailableAsync())) {
    await Share.share({ message: o.fallbackText });
    return;
  }
  const { uri } = await native.Print.printToFileAsync({ html: o.html, ...PAGE });
  let file = uri;
  if (FileSystem.cacheDirectory) {
    file = `${FileSystem.cacheDirectory}${o.fileName}.pdf`;
    await FileSystem.deleteAsync(file, { idempotent: true });
    await FileSystem.moveAsync({ from: uri, to: file });
  }
  await native.Sharing.shareAsync(file, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: o.dialogTitle });
}
