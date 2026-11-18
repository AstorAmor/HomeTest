// Aviso de que la app va a abrir una hoja del sistema: compartir, elegir una foto o un archivo, la cámara, pedir un
// permiso, el navegador de dentro o los ajustes del móvil. Se llama justo antes de abrirla. Lo lee el bloqueo con
// Face ID / huella (AppLock): en Android esas hojas dejan la app «en segundo plano» aunque se siga viendo detrás, y
// sin el aviso tapaba la pantalla con la K (fundador, 2026-11-17, al compartir el informe de evolución). Reglas en
// src/logic/appLock.ts (isExpectedLeave). Sin dependencias: lo pueden importar las utilidades y las pantallas.

let expectedAt: number | null = null;

export function expectSystemUi() {
  expectedAt = Date.now();
}

export const systemUiExpectedAt = () => expectedAt;

// Ya se ha vuelto a la app: el aviso no vale para la próxima salida
export function clearSystemUi() {
  expectedAt = null;
}

// Lo mismo, envolviendo la llamada: `await withSystemUi(() => Share.share(...))`
export function withSystemUi<T>(open: () => Promise<T>): Promise<T> {
  expectSystemUi();
  return open();
}
