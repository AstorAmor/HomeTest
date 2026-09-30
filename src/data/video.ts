import { isRemoteActive, supabase } from '@/lib/supabase';

// Videoconsulta real con Daily. El servidor (Edge Function video-room) comprueba que
// quien llama es el paciente o el especialista de la cita, crea la sala privada y
// devuelve un pase personal. Sin cuenta (demo) no hay vídeo real.

export const videoAvailable = () => isRemoteActive();

export async function getVideoJoinUrl(appointmentId: string): Promise<string> {
  if (!supabase) throw new Error('Sign in to join the video consultation');
  const { data, error } = await supabase.functions.invoke('video-room', { body: { appointmentId } });
  if (error) {
    // El cuerpo de error de la función trae un mensaje legible
    const ctx = (error as any).context;
    const msg = ctx && typeof ctx.json === 'function' ? (await ctx.json().catch(() => null))?.error : null;
    throw new Error(msg ?? error.message);
  }
  if (!data?.configured) throw new Error('Video is not set up yet');
  return data.joinUrl as string;
}
