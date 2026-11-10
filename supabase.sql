-- Gemeinsame Bestenliste fuer den dplan Data Runner (Supabase).
-- Einmal im Supabase-Dashboard unter "SQL Editor" ausfuehren.
--
-- Die Tabelle selbst ist fuer Besuchende gesperrt (RLS ohne Policies).
-- Lesen und Eintragen geht nur ueber die zwei Funktionen unten, die
-- Eingaben pruefen und nur die Top 10 zurueckgeben.

create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  name       text        not null check (char_length(name) between 1 and 18),
  score      bigint      not null check (score between 0 and 1000000000),
  dist       bigint      not null check (dist  between 0 and 1000000000),
  level      int         not null check (level between 0 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists scores_score_idx on public.scores (score desc, id);

alter table public.scores enable row level security;
revoke all on public.scores from anon, authenticated;

-- Top 10 als JSON-Array (gleiches Format wie serve.ps1)
create or replace function public.top_scores()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(t), '[]'::json) from (
    select name, score, dist, level, created_at as date
    from scores
    order by score desc, id
    limit 10
  ) t;
$$;

-- Neuen Eintrag speichern; gibt { rank, scores } zurueck.
-- rank = Platz 0-9 in den Top 10, sonst -1.
create or replace function public.submit_score(p_name text, p_score bigint, p_dist bigint, p_level int)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  new_id bigint;
  pos    int;
begin
  p_name := left(btrim(coalesce(p_name, '')), 18);
  if p_name = '' then
    raise exception 'Ungueltiger Eintrag';
  end if;

  insert into scores (name, score, dist, level)
  values (p_name, p_score, p_dist, p_level)
  returning id into new_id;

  select r - 1 into pos from (
    select id, row_number() over (order by score desc, id) as r
    from scores
    order by score desc, id
    limit 10
  ) t where t.id = new_id;

  return json_build_object('rank', coalesce(pos, -1), 'scores', top_scores());
end;
$$;

revoke all on function public.top_scores() from public;
revoke all on function public.submit_score(text, bigint, bigint, int) from public;
grant execute on function public.top_scores() to anon, authenticated;
grant execute on function public.submit_score(text, bigint, bigint, int) to anon, authenticated;
