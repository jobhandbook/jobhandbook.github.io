/* ==========================================================
   사이트 공통 설정 + 동작
   - 일정/링크는 window.SITE (Supabase 설정이 있으면 settings.next_class 가 덮어씀)
   - HTML 안의 data-bind="키" 요소에 자동으로 채워집니다.
   - 라운지(Q&A + 댓글 + 투표), 인사이트(글 + LinkedIn 임베드), 신청 · 문의 폼
   ========================================================== */
window.SITE = {
  // 다음 특강 (관리자 페이지에서 수정 가능. DB 미설정 시 이 값이 그대로 보임)
  nextDate: "2026년 11월 (일정 확정 시 공지)",
  nextDay: "토요일 또는 일요일",
  time: "13:00 – 18:00 (5시간)",
  place: "서울 (강의장 확정 시 공지)",
  seatsTotal: 20,
  seatsLeft: 20,
  noteText: "수강료와 입금 방법은 신청 확인 후 개별 안내드립니다.",

  // 수강료 — 사이트에는 표시하지 않고, 신청 확인 후 개별 안내 (관리자 참고용)
  price: "99,000원",

  // 연락 채널
  kakaoUrl: "https://open.kakao.com/o/gPZQAPlg",
  linkedin: "https://www.linkedin.com/in/joeyseo",
  linkedinShort: "linkedin.com/in/joeyseo",
  email: "joey.seo7@gmail.com",
  emailUrl: "mailto:joey.seo7@gmail.com",

  // SNS
  youtube: "https://www.youtube.com/@job_handbook",
  threads: "https://www.threads.com/@job_handbook",
  instagram: "https://www.instagram.com/job_handbook/",
  tiktok: "https://www.tiktok.com/@joeyseo99",
  book: "https://product.kyobobook.co.kr/detail/S000215610331",
};

(function () {
  const S = window.SITE;
  const DB = window.DB;
  const ready = !!(DB && DB.ready);
  const nl2br = (s) => esc(s).replace(/\n/g, "<br/>");

  function bindAll() {
    document.querySelectorAll("[data-bind]").forEach((el) => {
      const key = el.getAttribute("data-bind");
      if (S[key] !== undefined && S[key] !== "" && S[key] !== null) el.textContent = S[key];
    });
    const bar = document.querySelector("[data-seats-bar]");
    if (bar && S.seatsTotal) {
      const used = Math.max(0, S.seatsTotal - S.seatsLeft);
      bar.style.width = Math.round((used / S.seatsTotal) * 100) + "%";
    }
  }
  bindAll();

  document.querySelectorAll("[data-href]").forEach((el) => {
    const key = el.getAttribute("data-href");
    if (S[key]) el.setAttribute("href", S[key]);
    else el.closest("[data-hide-if-empty]")?.remove();
  });

  if (ready) {
    DB.getSetting("next_class").then((v) => { if (v) { Object.assign(S, v); bindAll(); } }).catch(() => {});
  }

  // 모바일 메뉴
  const menuBtn = document.querySelector(".menu-btn");
  const nav = document.querySelector(".nav");
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      menuBtn.classList.toggle("open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
    });
    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => { nav.classList.remove("open"); menuBtn.classList.remove("open"); }));
  }

  const here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav a[href]").forEach((a) => {
    const href = a.getAttribute("href").split("#")[0];
    if (href && href === here) a.classList.add("active");
  });

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
  }

  // ==========================================================
  // 라운지 공통: 관리자 여부, 방문자 키, 닉네임 기억
  // ==========================================================
  let ADMIN = false;
  const adminReady = ready ? DB.currentUser().then((u) => { ADMIN = !!u; }).catch(() => {}) : Promise.resolve();
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  };
  function voterKey() {
    let k = store.get("jh_voter");
    if (!k) { k = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)); store.set("jh_voter", k); }
    return k;
  }
  const ADMIN_BADGE = `<span class="badge-admin">채용담당자</span>`;

  // ---------- 댓글 ----------
  function commentsBoxHtml(type, id, count, open) {
    return `<div class="cbox" data-ctype="${type}" data-cid="${id}">
      <button class="cbox-toggle" type="button" aria-expanded="${open ? "true" : "false"}">댓글 <b>${count || 0}</b><span class="chev">▾</span></button>
      <div class="cbox-body" ${open ? "" : "hidden"}></div>
    </div>`;
  }
  function commentHtml(c) {
    return `<div class="cmt ${c.is_admin ? "admin" : ""}" data-id="${c.id}">
      <div class="cmt-head"><b>${esc(c.nickname)}</b>${c.is_admin ? ADMIN_BADGE : ""}<span class="muted">${fmtAgo(c.created_at)}</span>
        <span class="cmt-actions">${c.is_admin ? "" : `<button type="button" data-act="report">신고</button><button type="button" data-act="del">삭제</button>`}</span></div>
      <p>${nl2br(c.body)}</p>
    </div>`;
  }
  function commentFormHtml() {
    const nick = store.get("jh_nick") || "";
    if (ADMIN) {
      return `<form class="cform admin"><textarea name="body" placeholder="채용담당자로 댓글을 남깁니다." required></textarea>
        <div class="cform-row"><span class="small muted">${ADMIN_BADGE} 서재민으로 게시됩니다</span><button class="btn btn-primary btn-sm" type="submit">댓글 남기기</button></div></form>`;
    }
    return `<form class="cform">
      <textarea name="body" placeholder="같은 고민을 했던 사람의 한마디가 큰 힘이 됩니다. 경력자라면 현장 이야기를 보태주세요." required maxlength="2000"></textarea>
      <div class="cform-row">
        <input name="nickname" placeholder="닉네임" maxlength="20" value="${esc(nick)}" required />
        <input name="pw" type="password" placeholder="비밀번호 4자+ (삭제용)" minlength="4" required autocomplete="new-password" />
        <button class="btn btn-primary btn-sm" type="submit">댓글 남기기</button>
      </div>
      <p class="hint cform-note">가입 없이 남길 수 있습니다. 비밀번호는 내 댓글을 지울 때만 씁니다. 개인정보가 담긴 내용은 비공개 질문으로 보내주세요.</p>
    </form>`;
  }
  async function loadComments(box) {
    const body = box.querySelector(".cbox-body");
    const type = box.dataset.ctype, id = Number(box.dataset.cid);
    body.innerHTML = `<p class="muted small">불러오는 중…</p>`;
    try {
      await adminReady;
      const rows = await DB.comments(type, id);
      body.innerHTML = `<div class="cmt-list">${rows.length ? rows.map(commentHtml).join("") : `<p class="muted small cmt-empty">첫 댓글을 남겨보세요.</p>`}</div>${commentFormHtml()}`;
      box.querySelector(".cbox-toggle b").textContent = rows.length;
    } catch (e) { body.innerHTML = `<p class="muted small">댓글을 불러오지 못했습니다.</p>`; }
  }
  document.addEventListener("click", async (e) => {
    const tg = e.target.closest(".cbox-toggle");
    if (tg) {
      const box = tg.closest(".cbox"); const body = box.querySelector(".cbox-body");
      const open = body.hidden; body.hidden = !open; tg.setAttribute("aria-expanded", String(open));
      if (open && !body.dataset.loaded) { body.dataset.loaded = "1"; loadComments(box); }
      return;
    }
    const act = e.target.closest(".cmt-actions button[data-act]");
    if (act) {
      const cmt = act.closest(".cmt"); const id = Number(cmt.dataset.id); const box = cmt.closest(".cbox");
      try {
        if (act.dataset.act === "del") {
          const pw = prompt("이 댓글을 쓸 때 입력한 비밀번호를 넣어주세요.");
          if (pw == null) return;
          const ok = await DB.deleteOwnComment(id, pw);
          if (!ok) { alert("비밀번호가 맞지 않습니다."); return; }
          loadComments(box);
        } else if (act.dataset.act === "report") {
          if (!confirm("이 댓글을 신고할까요? 신고가 누적되면 자동으로 숨겨지고 관리자가 확인합니다.")) return;
          await DB.reportComment(id); act.textContent = "신고됨"; act.disabled = true;
        }
      } catch (err) { alert(err.message || "실패했습니다."); }
    }
  });
  document.addEventListener("submit", async (e) => {
    const f = e.target.closest(".cform"); if (!f) return;
    e.preventDefault();
    const box = f.closest(".cbox"); const type = box.dataset.ctype, id = Number(box.dataset.cid);
    const fd = new FormData(f); const btn = f.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      if (ADMIN) await DB.adminComment(type, id, String(fd.get("body")).trim());
      else { store.set("jh_nick", String(fd.get("nickname")).trim()); await DB.addComment(type, id, String(fd.get("nickname")).trim(), String(fd.get("pw")), String(fd.get("body")).trim()); }
      await loadComments(box);
    } catch (err) {
      const note = f.querySelector(".cform-note"); const msg = err.message || "전송에 실패했습니다.";
      if (note) { note.textContent = msg; note.style.color = "var(--red)"; } else alert(msg);
      btn.disabled = false;
    }
  });
  // 정적 Q&A 페이지(q/*.html)의 댓글 영역: 바로 펼쳐서 표시
  document.querySelectorAll(".comments-mount").forEach((m) => {
    if (!ready) return;
    m.innerHTML = commentsBoxHtml(m.dataset.ctype, m.dataset.cid, m.dataset.count || 0, true);
    const box = m.querySelector(".cbox"); box.querySelector(".cbox-body").dataset.loaded = "1"; loadComments(box);
  });

  // ---------- 투표 ----------
  function pollHtml(q, results) {
    const opts = Array.isArray(q.poll_options) ? q.poll_options : [];
    const res = results || {};
    const total = opts.reduce((s, _, i) => s + (res[i] || 0), 0);
    const mine = store.get("jh_vote_" + q.id);
    const show = mine != null;
    return `<div class="poll" data-qid="${q.id}">
      ${opts.map((o, i) => {
        const n = res[i] || 0; const pct = total ? Math.round((n / total) * 100) : 0;
        return `<button type="button" class="poll-opt ${show ? "voted" : ""} ${String(mine) === String(i) ? "mine" : ""}" data-idx="${i}">
          <span class="poll-bar" style="width:${show ? pct : 0}%"></span>
          <span class="poll-label">${esc(o)}</span>${show ? `<span class="poll-pct">${pct}% · ${n}명</span>` : ""}
        </button>`;
      }).join("")}
      <p class="small muted poll-total">${total ? `${total}명 참여` : "첫 번째로 투표해 보세요"}${show ? " · 다시 누르면 변경됩니다" : ""}</p>
    </div>`;
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest(".poll-opt"); if (!b || !ready) return;
    const poll = b.closest(".poll"); const qid = Number(poll.dataset.qid); const idx = Number(b.dataset.idx);
    try {
      const res = await DB.pollVote(qid, idx, voterKey());
      store.set("jh_vote_" + qid, String(idx));
      const q = LOUNGE.find((x) => x.id === qid) || { id: qid, poll_options: [...poll.querySelectorAll(".poll-label")].map((l) => l.textContent) };
      poll.outerHTML = pollHtml(q, res);
    } catch (err) { alert(err.message || "투표에 실패했습니다."); }
  });

  // ==========================================================
  // 라운지 (qna.html)
  // ==========================================================
  let LOUNGE = [];
  let POLLS = {};
  const loungeEl = document.querySelector("#lounge");
  function loungeItemHtml(q) {
    const answered = q.status === "published" && q.answer;
    const weekly = q.kind === "weekly";
    const poll = q.kind === "poll";
    return `<article class="lounge-item ${weekly ? "weekly" : ""} ${poll ? "is-poll" : ""} ${q.pinned ? "pinned" : ""}" id="q-${q.id}" data-board="${esc(q.board || "prep")}" data-comments="${q.comment_count || 0}" data-date="${q.created_at}">
      <div class="meta">
        ${weekly ? `<span class="badge weekly-badge">이번 주 질문</span>` : `<span class="badge board-${esc(q.board || "prep")}">${esc(BOARDS[q.board] || "취준")}</span>`}
        ${poll ? `<span class="badge gray">투표</span>` : ""}
        ${!weekly && CATS[q.category] ? `<span class="badge gray">${esc(CATS[q.category])}</span>` : ""}
        ${q.situation ? `<span>${esc(q.situation)}</span>` : ""}
        <span>${esc(q.nickname || (weekly ? "서재민" : "익명"))}</span>
        <span>${fmtAgo(q.created_at)}</span>
        ${weekly || poll ? "" : answered ? `<span class="st ok">채용담당자 답변 완료</span>` : `<span class="st wait">답변 대기 · 먼저 의견을 나눠주세요</span>`}
      </div>
      <h3>${weekly ? "" : "Q. "}${esc(q.question)}</h3>
      ${poll ? pollHtml(q, POLLS[q.id]) : ""}
      ${answered ? `<div class="a">${ADMIN_BADGE}<div>${nl2br(q.answer)}</div></div>` : ""}
      ${commentsBoxHtml("question", q.id, q.comment_count, false)}
    </article>`;
  }
  function renderLounge() {
    const board = (document.querySelector(".board-filter button.active") || {}).dataset?.board || "all";
    const sort = (document.querySelector(".sort-filter button.active") || {}).dataset?.sort || "new";
    let rows = LOUNGE.filter((q) => board === "all" || q.board === board || q.pinned);
    rows.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.pinned && b.pinned && (a.kind === "weekly") !== (b.kind === "weekly")) return a.kind === "weekly" ? -1 : 1;
      if (sort === "hot") return (b.comment_count || 0) - (a.comment_count || 0) || (new Date(b.created_at) - new Date(a.created_at));
      if (sort === "wait") { const aw = a.status !== "published" ? 0 : 1, bw = b.status !== "published" ? 0 : 1; if (aw !== bw) return aw - bw; }
      return new Date(b.created_at) - new Date(a.created_at);
    });
    loungeEl.innerHTML = rows.length ? rows.map(loungeItemHtml).join("") : `<p class="muted">아직 글이 없습니다. 첫 질문을 남겨주세요.</p>`;
    const cnt = document.querySelector("#lounge-count"); if (cnt) cnt.textContent = LOUNGE.filter((q) => q.kind !== "weekly").length;
  }
  async function loadLounge() {
    if (!loungeEl || !ready) return;
    try {
      LOUNGE = await DB.loungeQuestions();
      const pollIds = LOUNGE.filter((q) => q.kind === "poll").map((q) => q.id);
      POLLS = pollIds.length ? await DB.pollResults(pollIds) : {};
      renderLounge();
      // 깊은 링크: #q-ID → 해당 글로 이동하고 댓글 펼침
      if (location.hash.startsWith("#q-")) {
        const el = document.querySelector(location.hash);
        if (el) { el.scrollIntoView({ block: "start" }); el.classList.add("hl"); const t = el.querySelector(".cbox-toggle"); if (t) t.click(); }
      }
    } catch (e) { loungeEl.innerHTML = `<p class="muted">글을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>`; }
  }
  document.querySelectorAll(".board-filter button, .sort-filter button").forEach((b) => b.addEventListener("click", () => {
    b.parentElement.querySelectorAll("button").forEach((x) => x.classList.remove("active")); b.classList.add("active"); renderLounge();
  }));
  loadLounge();

  // 메인 '최근 Q&A' (답변 완료 글 3개)
  function qaItemHtml(r) {
    return `
      <a class="qa-item link" href="qna.html#q-${r.id}" data-cat="${esc(r.category || "etc")}">
        <div class="meta"><span class="badge board-${esc(r.board || "prep")}">${esc(BOARDS[r.board] || "취준")}</span><span class="badge gray">${esc(CATS[r.category] || "기타")}</span><span>${esc(r.situation || "")}</span><span>${fmtDate(r.answered_at || r.created_at)}</span>${r.comment_count ? `<span>댓글 ${r.comment_count}</span>` : ""}</div>
        <h3>Q. ${esc(r.question)}</h3>
        <div class="a"><b>A.</b> ${esc(r.answer).replace(/\n/g, "<br/>")}</div>
      </a>`;
  }
  const qaRecent = document.querySelector("#qa-recent");
  if (qaRecent && ready) {
    DB.publishedQuestions().then((rows) => {
      if (!rows.length) return;
      const st = document.querySelector("#qa-recent-static"); if (st) st.style.display = "none";
      qaRecent.innerHTML = rows.slice(0, 3).map(qaItemHtml).join("");
    }).catch(() => {});
  }

  // ---------- 질문 폼 (메인 + 라운지 공용) ----------
  // 공개/비공개 선택. 공개면 이메일은 선택(댓글 · 답변 알림), 비공개면 필수(답변 수신). 투표로 올리기 지원.
  document.querySelectorAll("form.question-form").forEach((qForm) => {
    const emailBox = qForm.querySelector(".vis-email");
    const emailInput = emailBox ? emailBox.querySelector("input") : null;
    const emailLabel = emailBox ? emailBox.querySelector("label") : null;
    const pollBox = qForm.querySelector(".poll-fields");
    const pollToggle = qForm.querySelector("input[name=as_poll]");
    function syncVis() {
      const priv = (qForm.querySelector("input[name=visibility]:checked") || {}).value === "private";
      if (emailBox) {
        emailBox.hidden = false;
        if (emailInput) emailInput.required = priv;
        if (emailLabel) emailLabel.textContent = priv ? "답변 받을 이메일 (필수)" : "댓글 · 답변 알림 받을 이메일 (선택)";
      }
      if (pollBox) pollBox.closest(".poll-wrap").hidden = priv;
    }
    qForm.querySelectorAll("input[name=visibility]").forEach((r) => r.addEventListener("change", syncVis));
    if (pollToggle && pollBox) pollToggle.addEventListener("change", () => { pollBox.hidden = !pollToggle.checked; });
    syncVis();
    qForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(qForm);
      const note = qForm.querySelector(".form-note");
      const isPrivate = fd.get("visibility") === "private";
      const opts = pollToggle && pollToggle.checked && !isPrivate ? fd.getAll("opt").map((s) => String(s).trim()).filter(Boolean) : [];
      if (pollToggle && pollToggle.checked && !isPrivate && opts.length < 2) { if (note) note.textContent = "투표 선택지를 2개 이상 적어주세요."; return; }
      if (ready) {
        try {
          await DB.submitQuestion({ category: fd.get("topic"), board: fd.get("board") || "prep", situation: fd.get("status"), question: fd.get("question"), nickname: fd.get("nickname"), is_private: isPrivate, email: fd.get("email") || null, poll_options: opts });
          if (fd.get("nickname")) store.set("jh_nick", String(fd.get("nickname")));
          qForm.innerHTML = `<div class="form-ok">${isPrivate
            ? "접수됐습니다. 답변은 적어주신 이메일로만 보내드립니다. 어디에도 공개하지 않습니다."
            : "올라갔습니다. 라운지에 바로 보이고, 다른 분들이 먼저 의견을 남길 수 있습니다. 제 답변은 보통 하루 안에 답니다."}${!isPrivate && fd.get("email") ? " 댓글과 답변이 달리면 이메일로 알려드립니다." : ""}<br/><span class="small muted">내 서류와 면접을 직접 봐야 하는 문제라면 <a href="coaching.html" style="color:var(--accent)">1:1 코칭</a>, 기준부터 세우려면 <a href="apply.html" style="color:var(--accent)">공개 코칭</a>.</span>${!isPrivate && loungeEl ? `<br/><button type="button" class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="location.reload()">라운지 새로고침</button>` : ""}</div>`;
          if (loungeEl) loadLounge();
        } catch (err) {
          if (note) note.textContent = "전송에 실패했습니다. 잠시 후 다시 시도하거나 오픈카톡으로 질문해 주세요.";
        }
      } else {
        const text = `[취업 Q&A 질문${isPrivate ? " · 비공개" : ""}]\n상황: ${fd.get("status") || "-"}\n분야: ${CATS[fd.get("topic")] || fd.get("topic") || "-"}\n질문: ${fd.get("question") || "-"}${isPrivate ? "\n답변 이메일: " + fd.get("email") : ""}`;
        try { await navigator.clipboard.writeText(text); } catch (_) {}
        if (note) note.textContent = "질문 내용이 복사됐습니다. 열리는 오픈카톡방에 붙여넣기 해주세요.";
        window.open(S.kakaoUrl, "_blank", "noopener");
      }
    });
  });

  // ==========================================================
  // 인사이트 (글 + LinkedIn 임베드) — insight.html / 메인 최근 글
  // ==========================================================
  let POSTS = [];
  function postHtml(p) {
    const li = p.kind === "linkedin";
    const url = li ? (p.linkedin_url || p.link) : p.link;
    const embed = li ? linkedinEmbed(url) : null;
    const date = fmtDate(p.published_at || p.created_at);
    return `<article class="post ${li ? "li-post" : ""}" id="post-${p.id}" data-kind="${li ? "linkedin" : "article"}">
      <div class="meta">${li ? `<span class="badge li-badge"><svg class="li-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>LinkedIn</span>` : `<span class="badge">${esc(p.category || "인사이트")}</span>`}<span>${date}</span>${p.comment_count ? `<span>댓글 ${p.comment_count}</span>` : ""}</div>
      ${p.title && !(li && /^LinkedIn 글/.test(p.title)) ? `<h3>${esc(p.title)}</h3>` : ""}
      ${p.summary ? `<p>${nl2br(p.summary)}</p>` : ""}
      ${li
        ? (embed ? `<div class="li-embed"><iframe src="${esc(embed)}" height="560" frameborder="0" allowfullscreen title="LinkedIn 글"></iframe></div>` : "")
          + `<a class="more" href="${esc(url || S.linkedin)}" target="_blank" rel="noopener">LinkedIn에서 이어 읽기 →</a>`
        : `${p.body ? `<details><summary style="cursor:pointer;color:var(--accent);font-weight:700;font-size:14px">본문 읽기</summary><div style="margin-top:12px;color:var(--ink-2);font-size:15px;line-height:1.75">${nl2br(p.body)}</div></details>` : ""}${p.link ? `<a class="more" href="${esc(p.link)}" target="_blank" rel="noopener">원문 보기 →</a>` : ""}`}
      ${commentsBoxHtml("post", p.id, p.comment_count, false)}
    </article>`;
  }
  const postsDynamic = document.querySelector("#posts-dynamic");
  function renderPosts() {
    const kind = (document.querySelector(".kind-filter button.active") || {}).dataset?.kind || "all";
    const rows = POSTS.filter((p) => kind === "all" || (kind === "linkedin" ? p.kind === "linkedin" : p.kind !== "linkedin"));
    postsDynamic.innerHTML = rows.length ? rows.map(postHtml).join("") : `<p class="muted">해당하는 글이 없습니다.</p>`;
  }
  if (postsDynamic && ready) {
    DB.publishedPosts().then((rows) => {
      if (!rows.length) return;
      POSTS = rows;
      const st = document.querySelector("#posts-static"); if (st) st.style.display = "none";
      const kf = document.querySelector(".kind-filter"); if (kf) kf.hidden = false;
      renderPosts();
      const m = location.hash.match(/^#post-(\d+)$/) || location.search.match(/[?&]post=(\d+)/);
      if (m) { const el = document.querySelector("#post-" + m[1]); if (el) { el.scrollIntoView({ block: "start" }); el.classList.add("hl"); } }
    }).catch(() => {});
    document.querySelectorAll(".kind-filter button").forEach((b) => b.addEventListener("click", () => {
      b.parentElement.querySelectorAll("button").forEach((x) => x.classList.remove("active")); b.classList.add("active"); renderPosts();
    }));
  }
  // 메인 '최근 글'
  const postsRecent = document.querySelector("#posts-recent");
  if (postsRecent && ready) {
    DB.publishedPosts().then((rows) => {
      if (!rows.length) return;
      postsRecent.closest("[data-posts-recent]").hidden = false;
      postsRecent.innerHTML = rows.slice(0, 3).map((p) => {
        const li = p.kind === "linkedin";
        return `<a class="recent-post" href="insight.html#post-${p.id}">
          <span class="badge ${li ? "li-badge" : ""}">${li ? "LinkedIn" : esc(p.category || "인사이트")}</span>
          <b>${esc(p.title || "LinkedIn 글")}</b>
          <span class="muted small">${fmtDate(p.published_at || p.created_at)}${p.comment_count ? ` · 댓글 ${p.comment_count}` : ""}</span>
        </a>`;
      }).join("");
    }).catch(() => {});
  }

  // ==========================================================
  // 신청 · 문의 폼 (공개 코칭 신청 / 1:1 코칭 / 특강 요청 / 문의)
  // ==========================================================
  const TYPE_LABEL = { apply: "공개 코칭 신청", coaching: "1:1 코칭 신청", lecture: "특강 요청", inquiry: "문의" };
  const OK_MSG = {
    apply: "신청이 접수되었습니다. 24시간 안에 확정 여부와 수강료 · 입금 방법을 연락처로 안내드립니다.",
    coaching: "신청이 접수되었습니다. 24시간 안에 먼저 답을 드리고, 코칭이 필요하다면 진행 방식과 비용을 안내드립니다.",
    lecture: "요청이 접수되었습니다. 24시간 안에 가능한 일정과 구성안을 이메일로 보내드립니다.",
    inquiry: "문의가 접수되었습니다. 24시간 안에 답변드리겠습니다.",
  };
  // 폼마다 필드 구성이 달라 DB 컬럼(name/phone/email/situation/session/message)에 맞춰 합칩니다.
  const BUILDERS = {
    apply: (fd) => ({ name: fd.get("name"), phone: fd.get("phone"), email: fd.get("email"), situation: fd.get("situation"), session: fd.get("session"), message: fd.get("message") }),
    inquiry: (fd) => ({ name: fd.get("name"), phone: fd.get("phone"), email: fd.get("email"), situation: fd.get("situation"), session: null, message: fd.get("message") }),
    coaching: (fd) => ({ name: fd.get("name"), phone: fd.get("phone"), email: fd.get("email"), situation: `${fd.get("kind")} · ${fd.get("situation")}`, session: [fd.get("mode"), fd.get("time")].filter(Boolean).join(" · "), message: [fd.get("target") ? "목표: " + fd.get("target") : "", fd.get("message")].filter(Boolean).join("\n") }),
    lecture: (fd) => ({ name: `${fd.get("org")} · ${fd.get("person")}`, phone: fd.get("phone"), email: fd.get("email"), situation: [fd.get("audience"), fd.get("size")].filter(Boolean).join(" · "), session: [fd.get("date"), fd.get("mode")].filter(Boolean).join(" · "), message: [fd.get("message"), fd.get("budget") ? "예산: " + fd.get("budget") : ""].filter(Boolean).join("\n") }),
  };
  async function handleInquiry(form, type, builder) {
    const fd = new FormData(form);
    const b = BUILDERS[builder || type](fd);
    const payload = { type, name: b.name, phone: b.phone || null, email: b.email || null, situation: b.situation || null, session: b.session || null, message: b.message || null };
    const note = form.querySelector(".form-note");
    if (ready) {
      try {
        await DB.submitInquiry(payload);
        form.innerHTML = `<div class="form-ok">${OK_MSG[type]}</div>`;
      } catch (err) {
        if (note) note.textContent = "전송에 실패했습니다. 잠시 후 다시 시도하거나 오픈카톡으로 연락 주세요.";
      }
    } else {
      const text = `[${TYPE_LABEL[type]}]\n이름: ${payload.name}\n연락처: ${payload.phone || "-"}\n이메일: ${payload.email || "-"}\n상황: ${payload.situation || "-"}\n일정/방식: ${payload.session || "-"}\n내용: ${payload.message || "-"}`;
      try { await navigator.clipboard.writeText(text); } catch (_) {}
      if (note) note.textContent = "내용이 복사됐습니다. 열리는 오픈카톡방에 붙여넣기 해주세요.";
      window.open(S.kakaoUrl, "_blank", "noopener");
    }
  }
  [["#apply-form", "apply"], ["#contact-form", "inquiry"], ["#coaching-form", "coaching"], ["#request-form", "lecture"]].forEach(([sel, type]) => {
    const f = document.querySelector(sel);
    if (f) f.addEventListener("submit", (e) => { e.preventDefault(); handleInquiry(f, type); });
  });

  // ---------- 컨택하기 (contact.html): 기업 · 기관 / 취준생 · 경력직 두 입구 ----------
  // 기업 · 기관: 특강 · 세미나 · 자문은 lecture, 언론 · 제휴는 inquiry. 개인: 1:1 코칭은 coaching, 그 외는 inquiry.
  BUILDERS.org = (fd) => ({ name: `${fd.get("org")} · ${fd.get("person")}`, phone: fd.get("phone"), email: fd.get("email"), situation: [fd.get("kind"), fd.get("audience")].filter(Boolean).join(" · "), session: [fd.get("date"), fd.get("mode")].filter(Boolean).join(" · "), message: fd.get("message") });
  BUILDERS.person = (fd) => ({ name: fd.get("name"), phone: fd.get("phone"), email: fd.get("email"), situation: `${fd.get("who")} · ${fd.get("want")}`, session: null, message: fd.get("message") });
  const choice = document.querySelector(".contact-choice");
  if (choice) {
    const panels = { org: document.querySelector("#panel-org"), person: document.querySelector("#panel-person") };
    const hint = document.querySelector("#contact-hint");
    function pick(type, scroll) {
      choice.querySelectorAll("button").forEach((b) => { const on = b.dataset.type === type; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); });
      Object.entries(panels).forEach(([k, p]) => { if (p) p.hidden = k !== type; });
      if (hint) hint.hidden = true;
      if (scroll && panels[type]) panels[type].scrollIntoView({ behavior: "smooth", block: "start" });
    }
    choice.addEventListener("click", (e) => { const b = e.target.closest("button[data-type]"); if (b) pick(b.dataset.type, true); });
    const params = new URLSearchParams(location.search);
    const t = params.get("type");
    if (t === "org" || t === "person") {
      pick(t, false);
      const kind = params.get("kind");
      const sel = t === "org" ? document.querySelector("#o-kind") : document.querySelector("#p-want");
      if (kind && sel) [...sel.options].forEach((o) => { if (o.value.includes(kind) || o.textContent.includes(kind)) sel.value = o.value; });
    }
    const orgForm = document.querySelector("#contact-org-form");
    const personForm = document.querySelector("#contact-person-form");
    if (orgForm) orgForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const kind = new FormData(orgForm).get("kind") || "";
      handleInquiry(orgForm, /특강|세미나|자문/.test(kind) ? "lecture" : "inquiry", "org");
    });
    if (personForm) personForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(personForm);
      if (!String(fd.get("phone") || "").trim() && !String(fd.get("email") || "").trim()) { const n = personForm.querySelector(".form-note"); if (n) { n.textContent = "연락처나 이메일 중 하나는 적어주세요."; n.style.color = "var(--red)"; } return; }
      handleInquiry(personForm, fd.get("want") === "1:1 코칭" ? "coaching" : "inquiry", "person");
    });
  }
})();
