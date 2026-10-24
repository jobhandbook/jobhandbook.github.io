/* ==========================================================
   사이트 공통 설정 + 동작
   - 일정/링크는 window.SITE (Supabase 설정이 있으면 settings.next_class 가 덮어씀)
   - HTML 안의 data-bind="키" 요소에 자동으로 채워집니다.
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

  if (DB && DB.ready) {
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

  // ---------- Q&A 렌더 ----------
  function qaItemHtml(r) {
    return `
      <div class="qa-item" data-cat="${esc(r.category || "etc")}">
        <div class="meta"><span class="badge gray">${esc(CATS[r.category] || "기타")}</span><span>${esc(r.situation || "")}</span>${r.nickname ? `<span>${esc(r.nickname)}</span>` : ""}<span>${fmtDate(r.answered_at || r.created_at)}</span></div>
        <h3>Q. ${esc(r.question)}</h3>
        <div class="a"><b>A.</b> ${esc(r.answer).replace(/\n/g, "<br/>")}</div>
      </div>`;
  }
  const qaDynamic = document.querySelector("#qa-dynamic");
  if (qaDynamic && DB && DB.ready) {
    DB.publishedQuestions().then((rows) => {
      if (!rows.length) return;
      const st = document.querySelector("#qa-static"); if (st) st.style.display = "none";
      qaDynamic.innerHTML = rows.map(qaItemHtml).join("");
      applyFilter();
    }).catch(() => {});
  }
  // 메인 '최근 Q&A'
  const qaRecent = document.querySelector("#qa-recent");
  if (qaRecent && DB && DB.ready) {
    DB.publishedQuestions().then((rows) => {
      if (!rows.length) return;
      const st = document.querySelector("#qa-recent-static"); if (st) st.style.display = "none";
      qaRecent.innerHTML = rows.slice(0, 3).map(qaItemHtml).join("");
    }).catch(() => {});
  }
  const filters = document.querySelectorAll(".qa-filter button");
  function applyFilter() {
    const active = document.querySelector(".qa-filter button.active");
    const cat = active ? active.dataset.cat : "all";
    document.querySelectorAll(".qa-item").forEach((item) => { item.style.display = cat === "all" || item.dataset.cat === cat ? "" : "none"; });
  }
  if (filters.length) filters.forEach((b) => b.addEventListener("click", () => { filters.forEach((x) => x.classList.remove("active")); b.classList.add("active"); applyFilter(); }));

  // 질문 폼 (메인 + Q&A 페이지 공용) — 공개/비공개 선택, 비공개면 이메일 필수
  document.querySelectorAll("form.question-form").forEach((qForm) => {
    const emailBox = qForm.querySelector(".vis-email");
    const emailInput = emailBox ? emailBox.querySelector("input") : null;
    qForm.querySelectorAll("input[name=visibility]").forEach((r) => r.addEventListener("change", () => {
      const priv = qForm.querySelector("input[name=visibility]:checked").value === "private";
      if (emailBox) { emailBox.hidden = !priv; if (emailInput) emailInput.required = priv; }
    }));
    qForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(qForm);
      const note = qForm.querySelector(".form-note");
      const isPrivate = fd.get("visibility") === "private";
      if (DB && DB.ready) {
        try {
          await DB.submitQuestion({ category: fd.get("topic"), situation: fd.get("status"), question: fd.get("question"), nickname: fd.get("nickname"), is_private: isPrivate, email: isPrivate ? fd.get("email") : null });
          qForm.innerHTML = `<div class="form-ok">${isPrivate ? "접수됐습니다. 답변은 적어주신 이메일로만 보내드립니다. 어디에도 공개하지 않습니다." : "접수됐습니다. 답변이 올라오면 Q&A 페이지에서 볼 수 있습니다."} 바쁜 날은 조금 늦어도 반드시 답합니다.<br/><span class="small muted">내 서류와 면접을 직접 봐야 하는 문제라면 <a href="coaching.html" style="color:var(--accent)">1:1 코칭</a>, 기준부터 세우려면 <a href="apply.html" style="color:var(--accent)">공개 코칭</a>.</span></div>`;
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

  // ---------- 인사이트 ----------
  const postsDynamic = document.querySelector("#posts-dynamic");
  if (postsDynamic && DB && DB.ready) {
    DB.publishedPosts().then((rows) => {
      if (!rows.length) return;
      const st = document.querySelector("#posts-static"); if (st) st.style.display = "none";
      postsDynamic.innerHTML = rows.map((p) => `
        <article class="post">
          <div class="meta"><span class="badge">${esc(p.category || "인사이트")}</span><span>${fmtDate(p.published_at || p.created_at)}</span></div>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.summary || "")}</p>
          ${p.body ? `<details><summary style="cursor:pointer;color:var(--accent);font-weight:700;font-size:14px">본문 읽기</summary><div style="margin-top:12px;color:var(--ink-2);font-size:15px">${esc(p.body).replace(/\n/g, "<br/>")}</div></details>` : ""}
          ${p.link ? `<a class="more" href="${esc(p.link)}" target="_blank" rel="noopener">원문 보기 →</a>` : ""}
        </article>`).join("");
    }).catch(() => {});
  }

  // ---------- 신청 · 문의 폼 (공개 코칭 신청 / 1:1 코칭 / 특강 요청 / 문의) ----------
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
  async function handleInquiry(form, type) {
    const fd = new FormData(form);
    const b = BUILDERS[type](fd);
    const payload = { type, name: b.name, phone: b.phone || null, email: b.email || null, situation: b.situation || null, session: b.session || null, message: b.message || null };
    const note = form.querySelector(".form-note");
    if (DB && DB.ready) {
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
})();
