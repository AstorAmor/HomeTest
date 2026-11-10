import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';

// Tarjeta de emergencia, versión «Bloqueo» (fundador, 2026-11-06: «que vaya a la pantalla de bloqueo, no a la
// de inicio»). En Android el módulo local modules/kuova-wallpaper la pone solo en la pantalla de bloqueo
// (WallpaperManager.FLAG_LOCK). Solo existe en los APK hechos desde el 2026-11-06: en los anteriores, en iPhone
// (Apple no deja a las apps poner fondos) y en la web no hay módulo y la pantalla explica los pasos a mano.

export interface LockWallpaper {
  svg: any; // ref del <Svg> de la tarjeta (toDataURL de react-native-svg)
  fileName: string;
  size: { width: number; height: number };
}

interface KuovaWallpaperModule {
  setLockScreen(uri: string): Promise<boolean>;
}

const native = (): KuovaWallpaperModule | null =>
  Platform.OS === 'android' ? requireOptionalNativeModule<KuovaWallpaperModule>('KuovaWallpaper') : null;

export const canSetLockScreen = (): boolean => native() !== null;

// La imagen se guarda en la caché de la app (no en la galería) y de ahí va al fondo de bloqueo. Lanza el error
// si el sistema no deja: la pantalla lo cuenta y deja los pasos a mano.
export async function setLockScreen({ svg, fileName, size }: LockWallpaper): Promise<void> {
  const m = native();
  if (!m || !svg?.toDataURL || !FileSystem.cacheDirectory) throw new Error('Lock screen wallpaper not available');
  const data: string = await new Promise((resolve) => svg.toDataURL(resolve, size));
  const uri = `${FileSystem.cacheDirectory}${fileName}.png`;
  await FileSystem.writeAsStringAsync(uri, data.replace(/^data:image\/png;base64,/, ''), {
    encoding: FileSystem.EncodingType.Base64,
  });
  await m.setLockScreen(uri);
}
