-- Solicitudes con nota de voz: el mensaje escrito pasa a ser opcional si hay audio.
alter table public.consultation_requests add column audio_path text; -- request-audio/<patient_id>/<archivo>
alter table public.consultation_requests drop constraint consultation_requests_message_check;
alter table public.consultation_requests
  add constraint consultation_requests_message_check check (char_length(message) <= 4000),
  add constraint consultation_requests_has_content check (char_length(message) > 0 or audio_path is not null);

-- Audios privados (máx. 5 MB): el paciente los sube a su carpeta; los escucha él y el
-- especialista al que va dirigida la solicitud.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-audio', 'request-audio', false, 5242880,
        array['audio/m4a', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'audio/wav']);

create policy "request audio: patient uploads own" on storage.objects for insert to authenticated
  with check (bucket_id = 'request-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "request audio: patient reads own" on storage.objects for select to authenticated
  using (bucket_id = 'request-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "request audio: addressed specialist reads" on storage.objects for select to authenticated
  using (
    bucket_id = 'request-audio'
    and exists (
      select 1 from public.consultation_requests r
      where r.audio_path = name and r.professional_id = (select auth.uid())
    )
  );
