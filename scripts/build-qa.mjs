// 공개 Q&A를 검색엔진이 읽을 수 있는 정적 페이지(q/*.html)로 생성하고 sitemap.xml을 갱신합니다.
// GitHub Actions(.github/workflows/build-qa.yml)가 매일 실행합니다. 로컬 실행: node scripts/build-qa.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SITE = "https://jobhandbook.github.io";
const cfg = readFileSync(join(ROOT, "js/config.js"), "utf8");
const URL_ = (cfg.match(/SUPABASE_URL:\s*"([^"]+)"/) || [])[1];
const KEY = (cfg.match(/SUPABASE_ANON_KEY:\s*"([^"]+)"/) || [])[1];
if (!URL_ || !KEY) { console.log("Supabase 설정 없음 — 건너뜀"); process.exit(0); }

const CATS = { prep: "취업 준비", docs: "서류", linkedin: "링크드인", interview: "면접", job: "이직 · 연봉", foreign: "외국계", etc: "기타" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (iso) => { const d = new Date(iso); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`; };
const slugify = (q, id) => id + "-" + q.replace(/[^\p{L}\p{N}\s]/gu, "").trim().replace(/\s+/g, "-").slice(0, 40);

const res = await fetch(`${URL_}/rest/v1/questions?status=eq.published&is_private=eq.false&select=id,question,answer,category,situation,answered_at,created_at&order=answered_at.desc`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
if (!res.ok) { console.error("fetch failed", res.status, await res.text()); process.exit(1); }
const rows = await res.json();
console.log(`published Q&A: ${rows.length}`);

const nav = `
<header class="header"><div class="wrap">
  <a class="logo" href="../index.html"><span class="logo-mark">J</span>취업핸드북 <span class="muted" style="font-weight:600">· 서재민</span></a>
  <nav class="nav" aria-label="주요 메뉴">
    <a href="../qna.html">무엇이든 물어보세요</a><a href="../index.html#lecture">공개 코칭</a><a href="../coaching.html">1:1 코칭</a><a href="../request.html">특강 요청</a><a href="../index.html#profile">서재민은 누구</a><a href="../insight.html">인사이트</a>
    <a class="btn btn-primary btn-sm" href="../apply.html">공개 코칭 신청</a>
  </nav>
  <button class="menu-btn" aria-label="메뉴 열기" aria-expanded="false"><span></span><span></span><span></span></button>
</div></header>`;
const footer = `
<footer class="footer"><div class="wrap">
  <div><h4>취업핸드북 · 서재민</h4><p>취업 · 이직, 무엇이든 물어보세요.</p><p style="margin-top:10px" class="small">이메일 <a href="mailto:joey.seo7@gmail.com" style="color:var(--accent-2)">joey.seo7@gmail.com</a> · LinkedIn <a href="https://www.linkedin.com/in/joeyseo" target="_blank" rel="noopener" style="color:var(--accent-2)">linkedin.com/in/joeyseo</a></p></div>
  <div><h4>바로가기</h4><ul><li><a href="../qna.html">무엇이든 물어보세요</a></li><li><a href="../apply.html">공개 코칭 신청</a></li><li><a href="../coaching.html">1:1 코칭</a></li><li><a href="../request.html">특강 요청</a></li><li><a href="../privacy.html">개인정보처리방침</a></li></ul></div>
  <div><h4>채널</h4><ul><li><a href="https://open.kakao.com/o/gPZQAPlg" target="_blank" rel="noopener">오픈카톡방</a></li><li><a href="https://www.linkedin.com/in/joeyseo" target="_blank" rel="noopener">LinkedIn</a></li><li><a href="https://www.youtube.com/@job_handbook" target="_blank" rel="noopener">YouTube</a></li></ul></div>
  <div class="copy">© 2026 서재민. 본 사이트의 코칭 · 특강은 개인 자격으로 운영되며 소속 회사와 무관합니다.</div>
</div></footer>
<div class="float-cta"><a class="btn btn-kakao" href="https://open.kakao.com/o/gPZQAPlg" target="_blank" rel="noopener">질문하기</a><a class="btn btn-primary" href="../apply.html">공개 코칭 신청</a></div>
<script src="../js/main.js"></script>`;

const head = (title, desc, canonical, extra = "") => `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:title" content="${esc(title)}" /><meta property="og:description" content="${esc(desc)}" /><meta property="og:url" content="${canonical}" /><meta property="og:type" content="article" /><meta property="og:image" content="${SITE}/img/profile-slide.png" />
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="../css/style.css" />
${extra}
</head><body>`;

const qDir = join(ROOT, "q");
mkdirSync(qDir, { recursive: true });
const keep = new Set(["index.html"]);
const pages = [];

for (const r of rows) {
  const slug = slugify(r.question, r.id);
  const file = `${slug}.html`;
  keep.add(file);
  const url = `${SITE}/q/${encodeURI(file)}`;
  const title = `Q. ${r.question} — 채용담당자의 답 | 취업핸드북 서재민`;
  const desc = String(r.answer).replace(/\s+/g, " ").slice(0, 150);
  const ld = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "QAPage", mainEntity: { "@type": "Question", name: r.question, text: r.question, answerCount: 1, dateCreated: r.created_at, acceptedAnswer: { "@type": "Answer", text: r.answer, dateCreated: r.answered_at, author: { "@type": "Person", name: "서재민", url: SITE + "/" } } } })}</script>`;
  const related = rows.filter((x) => x.id !== r.id && x.category === r.category).slice(0, 4);
  const html = `${head(title, desc, url, ld)}
${nav}
<section class="page-hero"><div class="wrap">
  <span class="eyebrow">취업 · 이직 Q&A · ${esc(CATS[r.category] || "기타")}${r.situation ? " · " + esc(r.situation) : ""}</span>
  <h1 style="font-size:clamp(24px,3.2vw,34px)">Q. ${esc(r.question)}</h1>
  <p class="small muted" style="margin-top:8px">${fmt(r.answered_at || r.created_at)} · 답변 서재민 (채용 실무 18년 · 1,000명 이상 직접 채용)</p>
</div></section>
<section class="section"><div class="wrap qa-layout">
  <article>
    <div class="qa-item" style="border:0;padding-top:0"><div class="a" style="font-size:16.5px;line-height:1.8"><b>A.</b> ${esc(r.answer).replace(/\n/g, "<br/>")}</div></div>
    <div class="night-note" style="margin-top:28px">내 서류와 면접을 직접 봐야 하는 문제라면 <a href="../coaching.html" style="color:var(--accent)">1:1 코칭</a>, 기준부터 세우려면 <a href="../apply.html" style="color:var(--accent)">공개 코칭</a>.</div>
    ${related.length ? `<h3 style="margin-top:36px;font-size:18px">같은 주제의 다른 질문</h3><ul class="press">${related.map((x) => `<li><span class="date">${fmt(x.answered_at || x.created_at)}</span><span><a href="${encodeURI(slugify(x.question, x.id))}.html"><b>Q. ${esc(x.question)}</b></a></span><span></span></li>`).join("")}</ul>` : ""}
  </article>
  <aside class="qa-side">
    <div class="card"><h3>나도 물어보기</h3><p>무료입니다. 현직이라 낮에는 늦을 수 있지만 빠짐없이 답합니다. 비공개 가능.</p><a class="btn btn-primary" style="margin-top:12px;width:100%" href="../qna.html#question-form">질문 남기기</a><a class="btn btn-kakao" style="margin-top:8px;width:100%" href="https://open.kakao.com/o/gPZQAPlg" target="_blank" rel="noopener">오픈카톡으로 바로</a></div>
    <div class="card"><h3>전체 답변 보기</h3><p>지금까지 공개된 질문과 답변 ${rows.length}개.</p><a class="btn btn-ghost" style="margin-top:12px;width:100%" href="index.html">목록으로</a></div>
  </aside>
</div></section>
${footer}
</body></html>`;
  writeFileSync(join(qDir, file), html);
  pages.push({ url, lastmod: (r.answered_at || r.created_at).slice(0, 10), title: r.question, file, cat: r.category, date: r.answered_at || r.created_at });
}

// 목록 페이지
const listHtml = `${head("취업·이직 Q&A 전체 목록 — 채용담당자가 직접 답한 " + rows.length + "개 | 취업핸드북 서재민", "서류 탈락 이유, 첫 직장 선택, 면접, 링크드인, 이직, 연봉협상. 현직 채용 책임자 서재민이 답한 질문 전체 목록.", `${SITE}/q/index.html`)}
${nav}
<section class="page-hero"><div class="wrap"><span class="eyebrow">취업 · 이직 Q&A</span><h1>지금까지의 답변 ${rows.length}개</h1><p>채용하는 사람이 직접 답했습니다. 위로 대신, 지금 바꿀 한 가지만.</p></div></section>
<section class="section"><div class="wrap">
${rows.length ? `<ul class="press">${pages.map((p) => `<li><span class="date">${fmt(p.date)}</span><span><a href="${encodeURI(p.file)}"><b>Q. ${esc(p.title)}</b></a><em>${esc(CATS[p.cat] || "기타")}</em></span><a class="more" href="${encodeURI(p.file)}">답변 →</a></li>`).join("")}</ul>` : `<p class="muted">아직 공개된 답변이 없습니다. 첫 질문을 남겨주세요.</p>`}
<div style="margin-top:32px"><a class="btn btn-primary" href="../qna.html#question-form">질문 남기기</a></div>
</div></section>
${footer}
</body></html>`;
writeFileSync(join(qDir, "index.html"), listHtml);

// 오래된 페이지 정리
for (const f of readdirSync(qDir)) if (!keep.has(f)) unlinkSync(join(qDir, f));

// sitemap.xml 재생성
const PRI = { "": "1.0", "qna.html": "0.9", "apply.html": "0.8", "coaching.html": "0.8", "request.html": "0.8", "insight.html": "0.7", "contact.html": "0.4", "privacy.html": "0.1" };
const base = Object.keys(PRI).map((p) => `  <url><loc>${SITE}/${p}</loc><changefreq>weekly</changefreq><priority>${PRI[p]}</priority></url>`);
const qa = [`  <url><loc>${SITE}/q/index.html</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`, ...pages.map((p) => `  <url><loc>${p.url}</loc><lastmod>${p.lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`)];
writeFileSync(join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...base, ...qa].join("\n")}\n</urlset>\n`);
console.log(`generated ${pages.length} pages + q/index.html, sitemap updated`);
