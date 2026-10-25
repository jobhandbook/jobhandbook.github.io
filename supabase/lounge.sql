-- ==========================================================
-- 라운지 확장 (2026-10-25) — Q&A에 댓글 · 투표 · 말머리 · 이번 주 질문, 인사이트에 LinkedIn 글
-- schema.sql, notify.sql 다음에 SQL Editor 에서 전체 Run (여러 번 실행해도 안전)
-- 핵심 원칙
--  · 방문자(anon)는 테이블을 직접 읽지 않고 *_public 뷰로만 읽습니다 (이메일 · 비밀번호 해시 비노출)
--  · 댓글 작성 · 삭제 · 신고 · 투표는 함수(RPC)로만 — 비밀번호 해시와 도배 제한을 서버에서 처리
--  · 가입 없음: 닉네임 + 비밀번호(본인 댓글 삭제용)
-- ==========================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- 1) questions 확장 ----------
alter table public.questions add column if not exists board text not null default 'prep';           -- 말머리: prep 취준 / job 이직 / review 후기 / talk 고민
alter table public.questions add column if not exists kind text not null default 'question';        -- question / poll / weekly(이번 주 질문)
alter table public.questions add column if not exists poll_options jsonb;                            -- ["선택지1","선택지2",...] (2~4개)
alter table public.questions add column if not exists comment_count int not null default 0;
alter table public.questions add column if not exists pinned boolean not null default false;
alter table public.questions add column if not exists last_notified_at timestamptz;                  -- 질문자 댓글 알림 과다 방지

alter table public.questions drop constraint if exists questions_board_check;
alter table public.questions add constraint questions_board_check check (board in ('prep','job','review','talk'));
alter table public.questions drop constraint if exists questions_kind_check;
alter table public.questions add constraint questions_kind_check check (kind in ('question','poll','weekly'));
alter table public.questions drop constraint if exists questions_poll_check;
alter table public.questions add constraint questions_poll_check check (
  kind <> 'poll' or (jsonb_typeof(poll_options) = 'array' and jsonb_array_length(poll_options) between 2 and 4)
);

-- 테스트 데이터 정리
delete from public.questions where nickname = 'setup-test';

-- 공개 뷰 (이메일 제외, 비공개 · 숨김 제외). 답변 대기 중인 질문도 라운지에 보입니다.
create or replace view public.questions_public as
  select id, created_at, status, category, situation, nickname, question, answer, answered_at,
         board, kind, poll_options, comment_count, pinned
  from public.questions
  where is_private = false and status <> 'hidden';
grant select on public.questions_public to anon, authenticated;

-- 방문자 직접 읽기 정책 제거 (뷰로 대체), 제출 정책 보강
drop policy if exists "questions public read" on public.questions;
drop policy if exists "questions public insert" on public.questions;
create policy "questions public insert" on public.questions for insert to anon
  with check (status = 'pending' and answer is null and pinned = false and kind in ('question','poll')
              and char_length(question) between 5 and 2000 and coalesce(char_length(nickname), 0) <= 20);

-- ---------- 2) posts 확장 (LinkedIn 글) ----------
alter table public.posts add column if not exists kind text not null default 'article';   -- article / linkedin
alter table public.posts add column if not exists linkedin_url text;
alter table public.posts add column if not exists comment_count int not null default 0;
alter table public.posts drop constraint if exists posts_kind_check;
alter table public.posts add constraint posts_kind_check check (kind in ('article','linkedin'));

-- ---------- 3) 댓글 ----------
create table if not exists public.comments (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  target_type text not null check (target_type in ('question','post')),
  target_id bigint not null,
  nickname text not null check (char_length(nickname) between 1 and 20),
  pw_hash text,
  ip_hash text,
  body text not null check (char_length(body) between 1 and 2000),
  is_admin boolean not null default false,
  is_hidden boolean not null default false,
  reports int not null default 0
);
create index if not exists comments_target_idx on public.comments (target_type, target_id, created_at);
create index if not exists comments_ip_idx on public.comments (ip_hash, created_at);
alter table public.comments enable row level security;
drop policy if exists "comments admin all" on public.comments;
create policy "comments admin all" on public.comments for all to authenticated using (true) with check (true);
-- anon 은 정책 없음 → 뷰와 함수로만 접근

create or replace view public.comments_public as
  select id, created_at, target_type, target_id, nickname, body, is_admin
  from public.comments where is_hidden = false;
grant select on public.comments_public to anon, authenticated;

-- 댓글 수 집계
create or replace function public.sync_comment_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare t text; i bigint; n int;
begin
  t := coalesce(new.target_type, old.target_type); i := coalesce(new.target_id, old.target_id);
  select count(*) into n from public.comments where target_type = t and target_id = i and is_hidden = false;
  if t = 'question' then update public.questions set comment_count = n where id = i;
  else update public.posts set comment_count = n where id = i; end if;
  return null;
end $$;
drop trigger if exists comments_count on public.comments;
create trigger comments_count after insert or update or delete on public.comments
  for each row execute function public.sync_comment_count();

-- 요청자 IP 해시 (PostgREST 가 넘겨주는 헤더 기준, 없으면 null)
create or replace function public.req_ip_hash() returns text
language plpgsql stable as $$
declare h text;
begin
  begin
    h := split_part(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1);
  exception when others then h := null; end;
  if coalesce(h, '') = '' then return null; end if;
  return encode(extensions.digest(h || '|jh-ip', 'sha256'), 'hex');
end $$;

-- 댓글 쓰기 (방문자). 반환: 새 댓글 id
create or replace function public.add_comment(p_target_type text, p_target_id bigint, p_nickname text, p_pw text, p_body text)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare ok boolean; ip text; recent int; new_id bigint;
begin
  if p_target_type = 'question' then
    select exists(select 1 from public.questions where id = p_target_id and is_private = false and status <> 'hidden') into ok;
  elsif p_target_type = 'post' then
    select exists(select 1 from public.posts where id = p_target_id and published = true) into ok;
  else ok := false; end if;
  if not ok then raise exception '댓글을 달 수 없는 글입니다.'; end if;
  if char_length(trim(p_nickname)) < 1 or char_length(p_nickname) > 20 then raise exception '닉네임은 1~20자입니다.'; end if;
  if char_length(trim(p_body)) < 1 or char_length(p_body) > 2000 then raise exception '댓글은 1~2000자입니다.'; end if;
  if char_length(coalesce(p_pw, '')) < 4 then raise exception '비밀번호는 4자 이상입니다.'; end if;
  ip := public.req_ip_hash();
  if ip is not null then
    select count(*) into recent from public.comments where ip_hash = ip and created_at > now() - interval '10 minutes';
    if recent >= 6 then raise exception '잠시 후 다시 시도해 주세요. (도배 방지)'; end if;
  end if;
  insert into public.comments (target_type, target_id, nickname, pw_hash, ip_hash, body)
  values (p_target_type, p_target_id, trim(p_nickname), encode(extensions.digest(p_pw || '|jh-comment', 'sha256'), 'hex'), ip, trim(p_body))
  returning id into new_id;
  return new_id;
end $$;

-- 본인 댓글 삭제 (비밀번호 일치 시)
create or replace function public.delete_own_comment(p_id bigint, p_pw text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  delete from public.comments where id = p_id and is_admin = false
    and pw_hash = encode(extensions.digest(coalesce(p_pw, '') || '|jh-comment', 'sha256'), 'hex');
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- 신고 (3회 누적 시 자동 숨김, 관리자가 확인)
create or replace function public.report_comment(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.comments set reports = reports + 1, is_hidden = (reports + 1 >= 3) or is_hidden where id = p_id and is_admin = false;
end $$;

grant execute on function public.add_comment(text, bigint, text, text, text) to anon, authenticated;
grant execute on function public.delete_own_comment(bigint, text) to anon, authenticated;
grant execute on function public.report_comment(bigint) to anon, authenticated;

-- ---------- 4) 투표 ----------
create table if not exists public.poll_votes (
  question_id bigint not null references public.questions(id) on delete cascade,
  voter_key text not null,
  option_idx int not null,
  created_at timestamptz not null default now(),
  primary key (question_id, voter_key)
);
alter table public.poll_votes enable row level security;
drop policy if exists "poll admin all" on public.poll_votes;
create policy "poll admin all" on public.poll_votes for all to authenticated using (true) with check (true);

create or replace view public.poll_results as
  select question_id, option_idx, count(*)::int as votes from public.poll_votes group by question_id, option_idx;
grant select on public.poll_results to anon, authenticated;

create or replace function public.poll_vote(p_question_id bigint, p_option_idx int, p_voter_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare opts jsonb; res jsonb;
begin
  select poll_options into opts from public.questions where id = p_question_id and kind = 'poll' and is_private = false and status <> 'hidden';
  if opts is null then raise exception '투표할 수 없는 글입니다.'; end if;
  if p_option_idx < 0 or p_option_idx >= jsonb_array_length(opts) then raise exception '잘못된 선택지입니다.'; end if;
  if char_length(coalesce(p_voter_key, '')) < 8 then raise exception '잘못된 요청입니다.'; end if;
  insert into public.poll_votes (question_id, voter_key, option_idx) values (p_question_id, p_voter_key, p_option_idx)
    on conflict (question_id, voter_key) do update set option_idx = excluded.option_idx, created_at = now();
  select coalesce(jsonb_object_agg(option_idx, votes), '{}'::jsonb) into res from public.poll_results where question_id = p_question_id;
  return res;
end $$;
grant execute on function public.poll_vote(bigint, int, text) to anon, authenticated;

-- ---------- 5) 알림 ----------
-- 5-a) 질문자에게: 내 질문에 댓글이 달리거나 답변이 올라오면 (공개 질문 + 알림 이메일 남긴 경우). 질문당 1시간에 1회.
create or replace function public.send_mail(p_to text, p_subject text, p_text text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare cfg jsonb;
begin
  select value into cfg from public.notify_config where key = 'email';
  if cfg is null or coalesce(cfg->>'resend_key', '') = '' or coalesce(p_to, '') = '' then return; end if;
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (cfg->>'resend_key'), 'Content-Type', 'application/json'),
    body := jsonb_build_object('from', cfg->>'from', 'to', jsonb_build_array(p_to), 'subject', p_subject, 'text', p_text)
  );
end $$;

create or replace function public.notify_question_owner_on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare q record; site text;
begin
  if new.is_hidden or new.target_type <> 'question' then return new; end if;
  select id, question, email, is_private, last_notified_at into q from public.questions where id = new.target_id;
  if q.email is null or q.is_private then return new; end if;
  if q.last_notified_at is not null and q.last_notified_at > now() - interval '1 hour' then return new; end if;
  select value->>'site' into site from public.notify_config where key = 'email';
  perform public.send_mail(q.email,
    '[취업핸드북] 내 질문에 ' || case when new.is_admin then '서재민의 댓글' else '새 댓글' end || '이 달렸습니다',
    '질문: ' || left(q.question, 80) || E'\n\n' || new.nickname || case when new.is_admin then ' (채용담당자)' else '' end || ': ' || left(new.body, 300) || E'\n\n'
    || '보기: ' || coalesce(site, '') || '/qna.html#q-' || q.id || E'\n\n'
    || '이 메일은 질문 등록 시 남긴 주소로 보내며, 같은 질문에 대해 1시간에 1회만 발송됩니다.');
  update public.questions set last_notified_at = now() where id = q.id;
  return new;
end $$;
drop trigger if exists notify_owner_comment on public.comments;
create trigger notify_owner_comment after insert on public.comments
  for each row execute function public.notify_question_owner_on_comment();

create or replace function public.notify_question_owner_on_answer() returns trigger
language plpgsql security definer set search_path = public as $$
declare site text;
begin
  if new.status = 'published' and coalesce(old.status, '') <> 'published' and new.email is not null and new.is_private = false then
    select value->>'site' into site from public.notify_config where key = 'email';
    perform public.send_mail(new.email, '[취업핸드북] 질문에 답변이 올라왔습니다',
      '질문: ' || left(new.question, 80) || E'\n\n답변: ' || left(coalesce(new.answer, ''), 500) || E'\n\n'
      || '전체 보기: ' || coalesce(site, '') || '/qna.html#q-' || new.id);
  end if;
  return new;
end $$;
drop trigger if exists notify_owner_answer on public.questions;
create trigger notify_owner_answer after update of status on public.questions
  for each row execute function public.notify_question_owner_on_answer();

-- 5-b) 관리자에게: 댓글은 건건이 아니라 하루 1회 요약 (매일 08:00 KST = 23:00 UTC). 새 질문은 기존대로 즉시 알림.
create or replace function public.notify_comment_digest() returns void
language plpgsql security definer set search_path = public as $$
declare cfg jsonb; n int; body text; r record;
begin
  select value into cfg from public.notify_config where key = 'email';
  if cfg is null then return; end if;
  select count(*) into n from public.comments where created_at > now() - interval '24 hours' and is_admin = false;
  if n = 0 then return; end if;
  body := '지난 24시간 동안 댓글 ' || n || '개가 달렸습니다.' || E'\n\n';
  for r in
    select c.nickname, c.body, c.target_type, c.target_id, c.is_hidden,
           case when c.target_type = 'question' then (select left(question, 50) from public.questions where id = c.target_id)
                else (select left(title, 50) from public.posts where id = c.target_id) end as title
    from public.comments c where c.created_at > now() - interval '24 hours' and c.is_admin = false
    order by c.created_at desc limit 15
  loop
    body := body || '• [' || coalesce(r.title, '-') || '] ' || r.nickname || ': ' || left(r.body, 120) || case when r.is_hidden then ' (신고로 숨김)' else '' end || E'\n';
  end loop;
  body := body || E'\n관리: ' || coalesce(cfg->>'site', '') || '/admin.html';
  perform public.send_mail(cfg->>'to', '[취업핸드북] 라운지 댓글 요약 (' || n || '개)', body);
end $$;

create extension if not exists pg_cron;
do $$ begin
  perform cron.unschedule('lounge-comment-digest');
exception when others then null; end $$;
select cron.schedule('lounge-comment-digest', '0 23 * * *', $$select public.notify_comment_digest()$$);

-- 확인용:  select * from public.questions_public limit 3;  select * from cron.job;
