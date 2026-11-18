// Web: copia el texto al portapapeles (en el ordenador no hay menú de compartir que sirva para pegarlo en una IA).
// Si el navegador no deja, se descarga como fichero .txt. La versión del móvil es shareText.ts.

export type ShareTextResult = 'shared' | 'copied' | 'dismissed';

export const shareTextCopies = true;

export async function shareText(o: { text: string; title: string; fileName?: string }): Promise<ShareTextResult> {
  try {
    await navigator.clipboard.writeText(o.text);
    return 'copied';
  } catch {
    const url = URL.createObjectURL(new Blob([o.text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${o.fileName || o.title}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'shared';
  }
}
