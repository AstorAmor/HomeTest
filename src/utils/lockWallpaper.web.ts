import type { LockWallpaper } from './lockWallpaper';

// Web: un navegador no puede poner fondos de pantalla; la pantalla enseña los pasos de iPhone y de Android
export const canSetLockScreen = (): boolean => false;

export async function setLockScreen(_: LockWallpaper): Promise<void> {
  throw new Error('Lock screen wallpaper not available on the web');
}
