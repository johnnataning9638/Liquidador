-- Ampliación autorizada: datos públicos; no cambia TIM, IPC ni cálculos.
create table public.uvt_liquidador (
 anio integer primary key check(anio between 1988 and 2200),
 valor_uvt bigint,
 sancion_minima bigint not null check(sancion_minima>0),
 metodo text not null check(metodo in ('HISTORICO','UVT10')),
 aplicable_desde date not null,
 fuente_url text not null check(fuente_url like 'https://%'),
 norma text not null,
 resolucion_url text,
 documento_sha256 text check(documento_sha256 is null or documento_sha256 ~ '^[a-f0-9]{64}$'),
 estado text not null default 'ACTIVA' check(estado='ACTIVA'),
 verificado_en timestamptz not null default now(),
 check(aplicable_desde=make_date(anio,1,1)),
 check((anio<2007 and metodo='HISTORICO') or (anio>=2007 and metodo='UVT10' and valor_uvt is not null and valor_uvt>0 and sancion_minima=round(valor_uvt::numeric*10/1000)*1000))
);
alter table public.uvt_liquidador enable row level security;
revoke all on public.uvt_liquidador from public,anon,authenticated,service_role;
grant select on public.uvt_liquidador to anon,authenticated;
grant select,insert on public.uvt_liquidador to service_role;
create policy uvt_lectura_publica on public.uvt_liquidador for select to anon,authenticated using(estado='ACTIVA' and aplicable_desde <= (now() at time zone 'America/Bogota')::date);
-- Nunca sobrescribir un año: PK y permiso de inserción sin UPDATE para el actualizador.
insert into public.uvt_liquidador(anio,valor_uvt,sancion_minima,metodo,aplicable_desde,fuente_url,norma,documento_sha256,estado) values
(1988,null,10000,'HISTORICO','1988-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 2503 de 1987','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(1989,null,13000,'HISTORICO','1989-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 2671 de 1988','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(1990,null,16000,'HISTORICO','1990-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 3018 de 1989','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(1991,null,21000,'HISTORICO','1991-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 3100 de 1990','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(1992,null,34000,'HISTORICO','1992-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 2813 de 1991','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(1993,null,43000,'HISTORICO','1993-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 2065 de 1992','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(1994,null,52000,'HISTORICO','1994-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 2495 de 1993','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(1995,null,64000,'HISTORICO','1995-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 2806 de 1994','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(1996,null,77000,'HISTORICO','1996-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 2324 de 1995','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(1997,null,91000,'HISTORICO','1997-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 2301 de 1996','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(1998,null,110000,'HISTORICO','1998-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 3020 de 1997','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(1999,null,120000,'HISTORICO','1999-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 1090 de 1998','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(2000,null,130000,'HISTORICO','2000-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 2587 de 1999','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(2001,null,150000,'HISTORICO','2001-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 2661 de 2000','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(2002,null,160000,'HISTORICO','2002-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 2794 de 2001','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(2003,null,170000,'HISTORICO','2003-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 3257 de 2002','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(2004,null,180000,'HISTORICO','2004-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 3804 de 2003','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(2005,null,191000,'HISTORICO','2005-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 4344 de 2004','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(2006,20000,201000,'HISTORICO','2006-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Decreto 4715 de 2005','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(2007,20974,210000,'UVT10','2007-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Resolucin 15652 de 2006 DIAN. Valor UVT','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(2008,22054,221000,'UVT10','2008-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Resolucin 15013 de 2007 DIAN. Valor UVT','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(2009,23763,238000,'UVT10','2009-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Resolucin 1063 de 2008 DIAN. Valor UVT','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(2010,24555,246000,'UVT10','2010-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Resolucin 12115 de 2009 DIAN. Valor UVT','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(2011,25132,251000,'UVT10','2011-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Resolucin 12066 de 2010 DIAN. Valor UVT','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(2012,26049,260000,'UVT10','2012-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Resolucin No.011963 de 2011. Valor UVT','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(2013,26841,268000,'UVT10','2013-01-01','https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf','Resolucin No.000138 de 2012. Valor UVT','a3ffd8b8907d1753f6328cab957fb6add65c9e239cd72ea1c05f2384dd0eb5ad','ACTIVA'),
(2014,27485,275000,'UVT10','2014-01-01','https://normograma.dian.gov.co/dian/compilacion/docs/concepto_tributario_dian_0000001_2018.htm','UVT oficial 2014; ET arts. 639 y 868',null,'ACTIVA'),
(2015,28279,283000,'UVT10','2015-01-01','https://normograma.dian.gov.co/dian/compilacion/docs/concepto_tributario_dian_0000001_2018.htm','UVT oficial 2015; ET arts. 639 y 868',null,'ACTIVA'),
(2016,29753,298000,'UVT10','2016-01-01','https://normograma.dian.gov.co/dian/compilacion/docs/concepto_tributario_dian_0000001_2018.htm','UVT oficial 2016; ET arts. 639 y 868',null,'ACTIVA'),
(2017,31859,319000,'UVT10','2017-01-01','https://normograma.dian.gov.co/dian/compilacion/docs/concepto_tributario_dian_0000001_2018.htm','UVT oficial 2017; ET arts. 639 y 868',null,'ACTIVA'),
(2018,33156,332000,'UVT10','2018-01-01','https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0063_2017.htm','UVT oficial 2018; ET arts. 639 y 868',null,'ACTIVA'),
(2019,34270,343000,'UVT10','2019-01-01','https://www.dian.gov.co/Prensa/ComunicadosPrensa/245_DIAN_fija_valor_de_la_UVT_para_2019.pdf','UVT oficial 2019; ET arts. 639 y 868',null,'ACTIVA'),
(2020,35607,356000,'UVT10','2020-01-01','https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0084_2019.htm','UVT oficial 2020; ET arts. 639 y 868',null,'ACTIVA'),
(2021,36308,363000,'UVT10','2021-01-01','https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?dt=S&i=103587','UVT oficial 2021; ET arts. 639 y 868',null,'ACTIVA'),
(2022,38004,380000,'UVT10','2022-01-01','https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0140_2021.htm','UVT oficial 2022; ET arts. 639 y 868',null,'ACTIVA'),
(2023,42412,424000,'UVT10','2023-01-01','https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_1264_2022.htm','UVT oficial 2023; ET arts. 639 y 868',null,'ACTIVA'),
(2024,47065,471000,'UVT10','2024-01-01','https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0187_2023.htm','UVT oficial 2024; ET arts. 639 y 868',null,'ACTIVA'),
(2025,49799,498000,'UVT10','2025-01-01','https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0193_2024.htm','UVT oficial 2025; ET arts. 639 y 868',null,'ACTIVA'),
(2026,52374,524000,'UVT10','2026-01-01','https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0227_2025.htm','UVT oficial 2026; ET arts. 639 y 868',null,'ACTIVA');
alter table public.parametros_actualizacion_log add column uvt jsonb not null default '{}'::jsonb;
create table public.parametros_actualizacion_control(id smallint primary key check(id=1),token_sha256 text not null check(token_sha256 ~ '^[a-f0-9]{64}$'));
alter table public.parametros_actualizacion_control enable row level security;
revoke all on public.parametros_actualizacion_control from public,anon,authenticated,service_role;
grant select on public.parametros_actualizacion_control to service_role;
create policy control_solo_servidor on public.parametros_actualizacion_control for select to service_role using(true);
do $migration$
declare token text; j record; nueva text;
begin
 select jobid,command,schedule into strict j from cron.job where jobname='actualizar-parametros-dian-diario';
 if j.schedule<>'0 10 * * *' then raise exception 'Horario de cron no reconocido';end if;
 token:=gen_random_uuid()::text||gen_random_uuid()::text;
 perform vault.create_secret(token,'liquidador_parametros_263','Autenticación interna del actualizador; no exponer');
 insert into public.parametros_actualizacion_control values(1,encode(extensions.digest(token,'sha256'),'hex'));
 nueva:=replace(j.command,'''Authorization'',','''X-Parametros-Token'',(select decrypted_secret from vault.decrypted_secrets where name=''liquidador_parametros_263''),''Authorization'',');
 if nueva=j.command then raise exception 'No se reconoció el encabezado del programador';end if;
 perform cron.alter_job(j.jobid,command:=nueva);
end $migration$;
