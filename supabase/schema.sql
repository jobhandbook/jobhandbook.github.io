-- ==========================================================
-- 취업핸드북 × 서재민 홈페이지 — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 Run 하세요. (여러 번 실행해도 안전)
-- 방문자(anon): 공개 Q&A · 글 · 일정 읽기, 질문 · 신청 · 문의 제출만 가능
-- 관리자(authenticated): 전부 가능 (Authentication > Users 에서 직접 만든 계정으로 로그인)
-- ==========================================================

-- 1) 사이트 설정 (다음 특강 일정 등)
create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- 2) Q&A (방문자가 질문 → 관리자가 답변 후 공개)
create table if not exists public.questions (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  status text not null default 'pending' check (status in ('pending','published','hidden')),
  category text default 'prep',
  situation text,
  nickname text,
  question text not null,
  answer text,
  answered_at timestamptz
);

-- 3) 특강 신청 · 문의
create table if not exists public.inquiries (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  type text not null check (type in ('apply','inquiry')),
  name text not null,
  phone text,
  email text,
  situation text,
  session text,
  message text,
  is_read boolean default false,
  memo text
);

-- 4) 인사이트 글
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  title text not null,
  category text,
  summary text,
  body text,
  link text,
  published boolean default false,
  published_at timestamptz
);

-- RLS 켜기
alter table public.settings  enable row level security;
alter table public.questions enable row level security;
alter table public.inquiries enable row level security;
alter table public.posts     enable row level security;

-- 정책 (재실행을 위해 먼저 삭제)
drop policy if exists "settings public read"   on public.settings;
drop policy if exists "settings admin all"     on public.settings;
drop policy if exists "questions public read"  on public.questions;
drop policy if exists "questions public insert" on public.questions;
drop policy if exists "questions admin all"    on public.questions;
drop policy if exists "inquiries public insert" on public.inquiries;
drop policy if exists "inquiries admin all"    on public.inquiries;
drop policy if exists "posts public read"      on public.posts;
drop policy if exists "posts admin all"        on public.posts;

create policy "settings public read"    on public.settings  for select using (true);
create policy "settings admin all"      on public.settings  for all to authenticated using (true) with check (true);

create policy "questions public read"   on public.questions for select using (status = 'published');
create policy "questions public insert" on public.questions for insert to anon
  with check (status = 'pending' and answer is null);
create policy "questions admin all"     on public.questions for all to authenticated using (true) with check (true);

create policy "inquiries public insert" on public.inquiries for insert to anon with check (true);
create policy "inquiries admin all"     on public.inquiries for all to authenticated using (true) with check (true);

create policy "posts public read"       on public.posts     for select using (published = true);
create policy "posts admin all"         on public.posts     for all to authenticated using (true) with check (true);

-- 기본 일정 값 (관리자 페이지에서 바로 수정 가능)
insert into public.settings (key, value) values (
  'next_class',
  '{"nextDate":"2026년 11월 (일정 확정 시 공지)","nextDay":"토요일 또는 일요일","time":"13:00 – 18:00 (5시간)","place":"서울 (강의장 확정 시 공지)","seatsTotal":20,"seatsLeft":20,"noteText":"수강료와 입금 방법은 신청 확인 후 개별 안내드립니다."}'::jsonb
) on conflict (key) do nothing;
