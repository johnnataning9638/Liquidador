-- No modifica ninguna tasa, IPC ni fórmula existente.
create table if not exists public.parametros_actualizacion_log (
 id bigint generated always as identity primary key,
 version text not null,
 dry_run boolean not null default false,
 inicio timestamptz not null,
 fin timestamptz not null,
 ok boolean not null,
 tim jsonb not null,
 ipc jsonb not null
);
alter table public.parametros_actualizacion_log enable row level security;
revoke all on public.parametros_actualizacion_log from anon,authenticated;
grant select on public.parametros_actualizacion_log to authenticated;
grant all on public.parametros_actualizacion_log to service_role;
grant usage,select on sequence public.parametros_actualizacion_log_id_seq to service_role;
create policy parametros_log_admin_read on public.parametros_actualizacion_log for select to authenticated
 using (exists(select 1 from public.admin_users a where lower(a.email)=lower(coalesce((select auth.jwt())->>'email',''))));
create unique index if not exists tasas_liquidador_periodo_tipo_unique
 on public.tasas_liquidador(fecha_inicio,fecha_fin,tipo_tasa);
do $migration$
declare j record;new_command text;
begin
 select jobid,command,schedule into strict j from cron.job where jobname='actualizar-parametros-dian-diario';
 if j.schedule<>'0 10 * * *' then raise exception 'Revisar horario del cron antes de aplicar';end if;
 if position('timeout_milliseconds' in j.command)=0 then
  new_command=replace(j.command,'body := ''{}''::jsonb','body := ''{}''::jsonb, timeout_milliseconds := 90000');
  if new_command=j.command then raise exception 'Formato del cron no reconocido';end if;
  perform cron.alter_job(j.jobid,command:=new_command);
 end if;
end $migration$;
