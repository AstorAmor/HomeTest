// ¿Se acaba de guardar un check-in? El botón de Hoy celebra (confeti y la carita hacia delante) cuando
// con él se completan los 3 del día, y solo entonces: al abrir la app con los 3 ya hechos, o cuando
// llegan de la nube, no salta nada.
let savedAt = 0;
export const noteCheckInSaved = (now = Date.now()) => {
  savedAt = now;
};
export const checkInSavedRecently = (now = Date.now(), withinMs = 2 * 60 * 1000) => savedAt > 0 && now - savedAt < withinMs;
// Que no vuelva a saltar si Hoy se recarga
export const clearCheckInSaved = () => {
  savedAt = 0;
};
