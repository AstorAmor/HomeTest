// Sala de vídeo (Daily) para una cita. Solo el paciente o el especialista de la cita
// pueden pedirla. La sala es privada: sin el pase (token) personal no se entra, y
// caduca 2 h después del final previsto de la cita.
// Secreto: DAILY_API_KEY (npx supabase secrets set DAILY_API_KEY=…).
import { json, serve } from '../_shared/http.ts';
import { adminClient } from '../_shared/payments.ts';

const DAILY = 'https://api.daily.co/v1';

async function daily(path: string, init: RequestInit = {}) {
  const res = await fetch(`${DAILY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${Deno.env.get('DAILY_API_KEY')}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

serve(async (body, userId) => {
  if (!Deno.env.get('DAILY_API_KEY')) return json({ configured: false });
  const appointmentId = String(body?.appointmentId ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(appointmentId)) return json({ error: 'Invalid appointment' }, 400);

  const db = adminClient();
  const { data: appt } = await db
    .from('appointments')
    .select('id, professional_id, patient_id, patient_name, ends_at, status, modality, professionals(display_name)')
    .eq('id', appointmentId)
    .maybeSingle();
  if (!appt) return json({ error: 'Appointment not found' }, 404);
  const isPro = appt.professional_id === userId;
  if (!isPro && appt.patient_id !== userId) return json({ error: 'Not your appointment' }, 403);
  if (appt.status === 'cancelled') return json({ error: 'This appointment was cancelled' }, 409);

  const exp = Math.floor(new Date(appt.ends_at).getTime() / 1000) + 2 * 3600;
  const name = `ht-${appointmentId.replace(/-/g, '').slice(0, 24)}`;

  let room = await daily(`/rooms/${name}`);
  if (room.status === 404) {
    room = await daily('/rooms', {
      method: 'POST',
      body: JSON.stringify({
        name,
        privacy: 'private',
        properties: {
          exp,
          eject_at_room_exp: true,
          enable_prejoin_ui: true,
          enable_screenshare: true,
          enable_chat: false, // el chat va por HomeTest
          start_video_off: appt.modality === 'voice',
          lang: 'en',
        },
      }),
    });
  }
  if (!room.ok) return json({ error: `Video provider error (${room.status})` }, 502);

  const proName = (appt as any).professionals?.display_name ?? 'Specialist';
  const token = await daily('/meeting-tokens', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        room_name: name,
        user_name: isPro ? proName : appt.patient_name ?? 'Patient',
        user_id: userId,
        is_owner: isPro,
        exp,
      },
    }),
  });
  if (!token.ok) return json({ error: `Video provider error (${token.status})` }, 502);

  const url = room.body.url as string;
  await db.from('appointments').update({ video_room_url: url }).eq('id', appointmentId);
  return json({ configured: true, url, token: token.body.token, joinUrl: `${url}?t=${token.body.token}` });
});
