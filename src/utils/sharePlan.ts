import { Share } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';
import { PlanDoc, planFileName, planToHtml, planToText } from './planPdf';

// Móvil: el plan se convierte en PDF (expo-print) y se abre el menú de compartir del
// sistema (expo-sharing) → WhatsApp, correo, Drive, el médico… La web tiene su propia
// versión (sharePlan.web.ts).
//
// expo-print y expo-sharing son módulos nativos añadidos el 2026-10-07: la APK
// instalada antes no los lleva y recibe igualmente las EAS Update (runtimeVersion =
// sdkVersion). Por eso se cargan aquí bajo demanda y, si faltan, se comparte el plan
// como texto en vez de romper la app. Con una APK nueva ya sale el PDF.

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

// A4 en puntos (72 ppp). Los márgenes de Android y web los pone el @page del HTML.
const PAGE = { width: 595, height: 842, margins: { left: 36, right: 36, top: 40, bottom: 40 } };

export const planShareSupport = () => ({ sendPdf: true, print: loadNative() !== null });

export async function sharePlanPdf(doc: PlanDoc): Promise<void> {
  const native = loadNative();
  if (!native || !(await native.Sharing.isAvailableAsync())) {
    await Share.share({ title: 'My personalised plan', message: planToText(doc) });
    return;
  }
  const { uri } = await native.Print.printToFileAsync({ html: planToHtml(doc), ...PAGE });
  // Nombre legible para quien lo recibe ("Kuova-plan-2026-10-07.pdf") en vez del aleatorio
  let file = uri;
  if (FileSystem.cacheDirectory) {
    file = `${FileSystem.cacheDirectory}${planFileName(doc)}.pdf`;
    await FileSystem.deleteAsync(file, { idempotent: true });
    await FileSystem.moveAsync({ from: uri, to: file });
  }
  await native.Sharing.shareAsync(file, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Send your plan',
  });
}

export async function printPlan(doc: PlanDoc): Promise<void> {
  const native = loadNative();
  if (!native) throw new Error('Printing needs the latest version of the app.');
  await native.Print.printAsync({ html: planToHtml(doc), ...PAGE });
}
