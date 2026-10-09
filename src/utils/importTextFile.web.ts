// Importar el texto de un documento en la web (plantillas del especialista): .txt, .md y .docx.
// El .docx es un zip: se busca word/document.xml y se descomprime con DecompressionStream del
// navegador, sin librerías. PDF y .doc antiguos no se leen aquí: se pide copiar y pegar.

export const canImportTextFile = true;

export function pickTextFile(): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.docx,.pdf,.doc,text/plain,text/markdown';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const lower = file.name.toLowerCase();
      try {
        if (lower.endsWith('.docx')) resolve({ name: file.name, text: await docxToText(await file.arrayBuffer()) });
        else if (lower.endsWith('.pdf') || lower.endsWith('.doc'))
          reject(new Error('PDF and old .doc files can’t be read here yet. Open the file, copy the text and paste it.'));
        else resolve({ name: file.name, text: (await file.text()).trim() });
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Could not read the file'));
      }
    };
    input.click();
  });
}

async function docxToText(buf: ArrayBuffer): Promise<string> {
  const view = new DataView(buf);
  // Fin del directorio central del zip (firma 0x06054b50), buscando desde el final
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('This is not a valid .docx file');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const utf8 = new TextDecoder();
  for (let n = 0; n < count && view.getUint32(p, true) === 0x02014b50; n++) {
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    if (utf8.decode(new Uint8Array(buf, p + 46, nameLen)) === 'word/document.xml') {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const data = new Uint8Array(buf, start, size);
      let xml: string;
      if (method === 0) xml = utf8.decode(data);
      else if (method === 8) xml = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
      else throw new Error('Unsupported .docx compression');
      return xmlToText(xml);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('No text found in this .docx');
}

// Párrafos de Word → líneas; viñetas y tabuladores, lo justo para que se lea bien
const xmlToText = (xml: string) =>
  xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<w:numPr>/g, '• ')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
