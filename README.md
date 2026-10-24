# 취업핸드북 × 서재민 — 오프라인 취업특강 홈페이지

현직 채용리더가 전수하는 취업준비 A to Z, 하루에 끝내기 (월 1~2회, 5시간 오프라인 특강) 홈페이지입니다.
순수 HTML/CSS/JS 정적 사이트라 서버 없이 GitHub Pages, Vercel, Netlify, Cloudflare Pages 어디에나 그대로 올라갑니다.

## 현재 연결 상태 (2026-10-24)

- Supabase 프로젝트 **job-handbook** (조직 Job Handbook, 리전 시드니 — 생성 당시 서울 리전 장애로 자동 배정) 생성 완료
- `schema.sql` 실행 완료, `js/config.js`에 URL과 publishable 키 입력 완료 → 사이트가 DB에서 일정을 읽고 질문을 저장하는 것까지 확인
- 관리자 계정 joey.seo7@gmail.com 생성 완료 → `admin.html`에서 로그인 가능
- 알림 트리거(`notify_question`, `notify_inquiry`) 설치 + Resend 키 등록 완료 → 테스트 질문으로 joey.seo7@gmail.com 메일 발송 성공(Resend 응답 200) 확인
- 배포 후 할 일: 메일 안의 '답변하기' 링크가 동작하도록 사이트 주소 등록 (Supabase SQL Editor에서 한 줄)
  ```sql
  update public.notify_config set value = value || '{"site": "https://배포주소"}'::jsonb where key = 'email';
  ```
- 테스트로 넣은 질문 2개(닉네임 setup-test)는 관리자 페이지 'Q&A 답변' 탭에서 삭제하면 됩니다
- 대시보드: https://supabase.com/dashboard/project/imlizgbzxpwoevhvpvsi

## 관리자 모드 설정 (한 번만, 약 10분)

사이트는 서버 없이도 열리지만, **관리자 페이지(일정 수정 · Q&A 답변 · 신청/문의 확인 · 글 올리기)와 방문자 질문/신청 접수**는 무료 데이터베이스 Supabase가 필요합니다.

1. https://supabase.com 가입 → **New project** (Region: Northeast Asia (Seoul), DB 비밀번호 메모)
2. 왼쪽 **SQL Editor → New query** → `supabase/schema.sql` 내용 전체 붙여넣기 → **Run**
3. **Authentication → Users → Add user** → 관리자 이메일 · 비밀번호 입력, *Auto Confirm User* 체크. (회원가입 기능은 없으므로 이 계정만 로그인됩니다)
4. **Project Settings → API** → `Project URL`과 `anon public` 키를 `js/config.js`에 붙여넣기
5. 사이트의 `admin.html` 접속 → 로그인

### 새 질문 · 신청 · 문의가 오면 이메일 알림 받기 (joey.seo7@gmail.com)

1. https://resend.com 에 **joey.seo7@gmail.com 으로 가입** (무료). 도메인 인증 없이 본인 이메일로는 바로 보낼 수 있습니다.
2. Resend **API Keys → Create** → `re_`로 시작하는 키 복사
3. 트리거는 이미 설치돼 있으므로 Supabase **SQL Editor**에서 키만 넣으면 됩니다: `update public.notify_config set value = value || '{"resend_key": "re_실제키"}'::jsonb where key = 'email';` (처음부터 다시 설치해야 할 때만 `supabase/notify.sql` 전체를 실행)
4. 사이트에서 질문을 하나 보내보면 메일이 옵니다 (스팸함 확인). 메일에는 내용과 관리자 페이지 링크가 들어 있어 바로 답변할 수 있습니다.

키는 DB 안의 `notify_config` 테이블에만 저장되고 사이트 코드에는 들어가지 않습니다.

방문자가 할 수 있는 것: 공개된 Q&A · 글 · 일정 읽기, 질문 · 신청서 · 문의 제출. 그 외는 전부 로그인한 관리자만 가능합니다(DB 규칙으로 잠겨 있음). anon 키는 공개돼도 됩니다. `service_role` 키는 절대 사이트에 넣지 마세요.

설정 전(비워둔 상태)에는: 일정은 `js/main.js`의 값이 보이고, 질문 · 신청 · 문의 버튼은 내용을 복사해 오픈카톡방을 여는 방식으로 동작합니다.

## 파일 구성

| 파일 | 내용 |
|---|---|
| `index.html` | 메인: **히어로 = "취업·이직, 무엇이든 물어보세요" + 질문 폼** → 연락 타일(오픈카톡 · LinkedIn · 이메일) → 최근 Q&A → 오프라인 특강 소개 + 다음 특강 카드 → 채용 트렌드 → 5시간 커리큘럼 → 6단계 → 첫 직장 4가지 선택지 → 채용담당자의 속마음 → 기업의 채용 Process → 프로필/언론·강연 → 『취업핸드북』 → 후기 → 신청방법 → FAQ → 커뮤니티 |
| `qna.html` | 무엇이든 물어보세요: 관리자가 답변해 공개한 Q&A(DB) + 질문 보내기 폼. DB에 공개 글이 없으면 기본 Q&A 15개(책 기반 초안)가 보임 |
| `apply.html` / `contact.html` | 특강 신청서 / 문의 폼. 가격은 표시하지 않고 신청 확인 후 개별 안내 |
| `admin.html` | 관리자 페이지: 특강 일정 · Q&A 답변/직접 등록 · 신청/문의 확인(메모, 문자/이메일 바로가기) · 인사이트 글 작성/공개 |
| `insight.html` | 관리자가 올린 글(DB) + 초안 5개(DB에 글이 없을 때) + 언론 노출 링크 |
| `js/config.js` | Supabase URL · anon 키 (관리자 모드 설정 시 입력) |
| `js/db.js` | DB 읽기/쓰기 래퍼. 설정이 없으면 `DB.ready === false` |
| `supabase/schema.sql` | 테이블 4개(settings · questions · inquiries · posts)와 접근 규칙 |
| `supabase/notify.sql` | 새 질문 · 신청 · 문의 → joey.seo7@gmail.com 이메일 알림 (Resend 키 필요) |
| `css/style.css` | 전체 스타일. 색·폰트는 맨 위 `:root` 토큰만 바꾸면 됩니다 |
| `js/main.js` | **특강 일정·가격·정원·링크 설정(`window.SITE`)**, 모바일 메뉴, Q&A 필터, 질문 폼 |
| `img/` | 실제 이미지: `profile.png`(프로필 컷아웃), `book.png`(표지 3D), `bookstore.jpg`(교보문고 취업 베스트 매대), `tv-todayjobs.jpg`(한국직업방송 출연), `poster-2025-11.png`(홍익대·고려대 특강 포스터), `slide-*.jpg`(실제 강의 슬라이드 4장), `profile-slide.png`(연사 프로필 슬라이드 원본) |
| `.claude/serve.ps1` | Python/Node 없이 미리보기용 정적 서버. `powershell -ExecutionPolicy Bypass -File .claude\serve.ps1 -Port 8766` 후 브라우저에서 `http://localhost:8766` |

## 자주 바꾸는 것

1. **다음 특강 일정 / 잔여석** → 관리자 페이지 '특강 일정' 탭에서 수정(DB 설정 후). 설정 전에는 `js/main.js` 맨 위 `window.SITE` 값.
2. **가격** → 사이트에 표시하지 않습니다(1기 99,000원은 `SITE.price`에 참고용으로만 있음). 신청서를 받은 뒤 개별 안내하세요.
3. **프로필 사진 / 책 표지** → `img/profile.png`, `img/book.png`를 교체하면 됩니다. 프로필은 배경이 투명한 컷아웃이라 네이비 그라데이션 위에 올라갑니다.
4. **후기** → `index.html`의 `#reviews` 섹션. 특강 수강생들이 LinkedIn으로 보낸 실제 메시지 6개를 넣었고, 개인정보 보호를 위해 이름 가운데 글자를 ○로 가렸습니다(본인 동의를 받으면 실명으로 바꿔도 됩니다). 1기 오프라인 특강 후기는 첫 회차 후 추가하세요.
5. **Q&A** → 관리자 페이지 'Q&A 답변' 탭. 방문자 질문은 '답변 대기'에 쌓이고, 답변을 적어 '공개 저장'하면 사이트에 올라갑니다. 'Q&A 직접 올리기'로 질문·답변을 한 번에 등록할 수도 있습니다. 공개 Q&A가 1개라도 생기면 `qna.html`의 기본 초안 15개는 자동으로 숨겨집니다(지우려면 `<div id="qa-static">` 블록 삭제).

## 아직 확정이 필요한 값 (사이트에 임시로 들어가 있음)

- 1기 가격: `99,000원` — **확정** (2026-10-24). 정가 비교 표시는 비워 두었고(`priceOriginal: ""`), 나중에 가격을 올릴 때 이전 가격을 넣으면 취소선으로 표시됩니다.
- 정원 20명, 환불 규정(7일 전 전액 / 3일 전 50%) — 예시 규정입니다.
- 장소 "서울 (강의장 확정 시 공지)", 일정 "2026년 11월".
- 1기 한정 『취업핸드북』 사인본 증정 — 제공 여부 확인 필요.

## 배포 (GitHub Pages 예시)

```bash
git init
git add .
git commit -m "취업특강 홈페이지 v1"
gh repo create job-handbook-site --public --source=. --push
```

그 다음 GitHub 저장소 Settings → Pages → Branch `main` / root 선택. 몇 분 뒤 `https://<계정>.github.io/job-handbook-site/` 로 접속됩니다. 커스텀 도메인(예: `jobhandbook.kr`)은 같은 화면에서 연결합니다.

## 다음 단계 로드맵 (Action Plan과 매핑)

| 단계 | 할 일 | 방법 |
|---|---|---|
| 1 | 신청 · 문의 접수 | ✅ 완료 (`apply.html`, `contact.html` → 관리자 페이지에서 확인). 결제는 신청 확인 후 계좌 안내, 추후 토스페이먼츠 링크 |
| 2 | 후기 수집 | 특강 종료 시 QR로 설문 → `#reviews`에 반영 |
| 3 | Q&A 커뮤니티 | ✅ 1차 완료 (질문 접수 → 관리자 답변 → 공개). 다음: 좋아요 · 댓글 · 알림 |
| 4 | 취업뉴스 하루 1건 자동 업로드 | GitHub Actions 스케줄(매일 아침) + 뉴스 RSS/검색 → Claude API로 요약·코멘트 생성 → `posts` 테이블에 '취업뉴스' 분류로 자동 삽입 |
| 5 | 인사이트 글쓰기 | ✅ 관리자 페이지 '인사이트 글' 탭에서 작성 · 공개. 스레드에 동시 발행 |
| 6 | 유튜브 연동 | YouTube Data API로 최신 영상 3개를 '강의 미리보기' 섹션에 자동 표시 |
| 7 | 플랫폼 연계 | 크몽·탈잉·클래스101에 같은 강의 등록, 사이트의 '크몽에서 신청' 버튼 활성화 |

## 콘텐츠 출처

**강의 콘텐츠의 중심은 `RAPA특강_첫직장_어디로_가야할까.pptx`(34장)입니다.** 채용 트렌드(수시채용·Specialist), 첫 직장이 중요한 3가지 이유, 첫 직장 4가지 선택지 비교표, 선택 기준 3질문, 취업준비 6단계, 직무 경쟁력 3요소, JD → Action Plan, 채용담당자의 속마음, 정규직만 고집하지 말라는 3단계 조언, 실행 체크리스트, 수강생 후기 문구가 모두 이 덱에서 왔습니다. `취업특강_서재민 본부장님 자료의 사본.pptx`(47장)에서는 슬라이드 이미지 4장, 프로필 사진, 책 표지, 서점·방송 사진, 자소서 8요소·면접 질문 리스트를 가져왔습니다.

**디자인은 2026년 외부 발표자료(그리팅 채인지 세미나 리캡에 실린 TA 3.0 슬라이드)의 시그니처를 그대로 따랐습니다.** 검은 배경(#0a0a0a), 오렌지 포인트(#f97316), 카드 상단 3px 오렌지 바, 작은 대문자 트래킹 라벨(eyebrow), 흰 볼드 헤드라인 + 회색 본문, 오렌지 테두리의 이탤릭 인용 박스, 강조 카드의 오렌지 외곽선. 섹션은 #0a0a0a와 #111111을 번갈아 써서 단조롭지 않게 했습니다. 색을 바꾸려면 `css/style.css` 맨 위 `:root` 토큰만 수정하면 됩니다. 그리팅 세미나 발표 현장 사진(`img/seminar-greeting.jpg`)은 그리팅 블로그에 공개된 사진이며 캡션에 출처를 표기했습니다. `가인지_INTERX_서재민_최종 (1).pptx`는 정상 PPTX가 아니라(파일 머리글 "SCDS") 열지 못했고, PDF 버전은 브라우저 미리보기에서 다운로드로 처리되어 화면으로 확인하지 못했습니다.

프로필·경력·언론 노출·강연 이력은 아래 공개 자료와 본인 발표자료(INTERX × UNIST 인재확보 협력제안, 2026.10)에서 가져왔습니다.

- 그리팅 채인지 세미나 리캡 / 세미나 안내 (2026.03)
- 링글 HR 웨비나 소개 페이지 및 블로그
- HR Insight 2026년 3월호 특집, 8월호 인터뷰
- 그리팅 고객사례: 인터엑스 TA 3.0
- 교보문고 / YES24 / 리디 『취업 핸드북』 도서 정보 (와일드북, 2025.02, 360쪽)
- 브런치 @recruiting 작가 소개

※ 폴더에 함께 있는 `20260420_TA_Process_2.0.pptx.pdf`, `One_IX_Talent_Link_인재확보_실행계획_20261013.pdf`, `INTERX_서재민 본부장_프로필*.pdf`는 사내 자료로 보고 사이트에 쓰지 않았습니다. 배포 전에 이 PDF/PPTX 원본 파일들은 사이트 폴더 밖으로 옮기는 것이 좋습니다(그대로 두면 함께 공개됩니다).
