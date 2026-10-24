-- ==========================================================
-- 새 질문 · 특강 신청 · 문의가 들어오면 이메일로 알림 (joey.seo7@gmail.com)
-- 준비물: Resend 무료 계정 (https://resend.com) — joey.seo7@gmail.com 으로 가입하면
--        도메인 인증 없이 "본인 이메일"로는 바로 보낼 수 있습니다. API Keys 에서 키 발급 (re_ 로 시작)
-- 사용법: 아래 re_여기에_키 를 실제 키로 바꾼 뒤, schema.sql 다음에 SQL Editor 에서 Run
-- ==========================================================

create extension if not exists pg_net with schema extensions;

-- 알림 설정 (RLS 켜고 정책을 만들지 않아 사이트에서는 절대 읽을 수 없음)
create table if not exists public.notify_config (
  key text primary key,
  value jsonb not null
);
alter table public.notify_config enable row level security;

insert into public.notify_config (key, value) values (
  'email',
  '{"resend_key": "re_여기에_키", "to": "joey.seo7@gmail.com", "from": "취업핸드북 알림 <onboarding@resend.dev>", "site": "https://여기에_사이트_주소"}'::jsonb
) on conflict (key) do update set value = excluded.value;

-- 트리거 함수: questions / inquiries 에 행이 생기면 Resend API 호출
create or replace function public.notify_new_row()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  cfg jsonb;
  subject text;
  body text;
begin
  select value into cfg from public.notify_config where key = 'email';
  if cfg is null or coalesce(cfg->>'resend_key', '') = '' or (cfg->>'resend_key') like 're_여기에%' then
    return new;
  end if;

  if tg_table_name = 'questions' then
    subject := '[취업핸드북] 새 질문' || case when coalesce(new.is_private, false) then ' (비공개 · 이메일 답변)' else '' end || ': ' || left(new.question, 40);
    body := '새 질문이 들어왔습니다.' || case when coalesce(new.is_private, false) then ' ※ 비공개 요청 — 공개하지 말고 아래 이메일로만 답변' else '' end || E'\n\n'
         || '분류: ' || coalesce(new.category, '-') || E'\n'
         || '상황: ' || coalesce(new.situation, '-') || E'\n'
         || '닉네임: ' || coalesce(new.nickname, '-') || E'\n'
         || '답변 이메일: ' || coalesce(new.email, '-') || E'\n\n'
         || new.question || E'\n\n'
         || '답변하기: ' || coalesce(cfg->>'site', '') || '/admin.html';
  else
    subject := '[취업핸드북] 새 ' || case new.type when 'apply' then '공개 코칭 신청' when 'coaching' then '1:1 코칭 신청' when 'lecture' then '특강 요청' else '문의' end || ': ' || new.name;
    body := case new.type when 'apply' then '공개 코칭 신청서' when 'coaching' then '1:1 코칭 신청서' when 'lecture' then '특강 요청' else '문의' end || '가 접수되었습니다.' || E'\n\n'
         || '이름: ' || new.name || E'\n'
         || '연락처: ' || coalesce(new.phone, '-') || E'\n'
         || '이메일: ' || coalesce(new.email, '-') || E'\n'
         || '상황/유형: ' || coalesce(new.situation, '-') || E'\n'
         || '희망 회차: ' || coalesce(new.session, '-') || E'\n\n'
         || coalesce(new.message, '') || E'\n\n'
         || '확인하기: ' || coalesce(cfg->>'site', '') || '/admin.html';
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (cfg->>'resend_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', cfg->>'from',
      'to', jsonb_build_array(cfg->>'to'),
      'subject', subject,
      'text', body
    )
  );
  return new;
end;
$$;

drop trigger if exists notify_question on public.questions;
create trigger notify_question after insert on public.questions
  for each row execute function public.notify_new_row();

drop trigger if exists notify_inquiry on public.inquiries;
create trigger notify_inquiry after insert on public.inquiries
  for each row execute function public.notify_new_row();

-- 확인: 관리자 페이지 'Q&A 직접 올리기'로 글을 하나 올리거나, 사이트에서 질문을 보내면
--       joey.seo7@gmail.com 으로 메일이 옵니다 (스팸함도 확인). 실패 내역은 SQL Editor 에서
--       select * from net._http_response order by created desc limit 5;  로 볼 수 있습니다.
