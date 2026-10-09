// Importar texto de un documento: solo en la web (importTextFile.web.ts). En el móvil se pega el texto.
export const canImportTextFile = false;

export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  return null;
}
