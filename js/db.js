/* ==========================================================
   DB 레이어 — Supabase 래퍼. 설정이 없으면 DB.ready === false.
   테이블: settings / questions / inquiries / posts / comments / poll_votes
   방문자는 questions_public · comments_public · poll_results 뷰와 RPC 함수로만 접근 (supabase/lounge.sql)
   ========================================================== */
window.DB = (function () {
  const cfg = window.CONFIG || {};
  const ready = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const client = ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  function fail(e) { console.error("[DB]", e); throw e; }
  async function rpc(name, args) {
    const { data, error } = await client.rpc(name, args);
    if (error) fail(error);
    return data;
  }

  return {
    ready,
    client,

    // ---- settings (key/value jsonb) ----
    async getSetting(key) {
      const { data, error } = await client.from("settings").select("value").eq("key", key).maybeSingle();
      if (error) fail(error);
      return data ? data.value : null;
    },
    async setSetting(key, value) {
      const { error } = await client.from("settings").upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) fail(error);
    },

    // ---- questions (라운지) ----
    // 공개 뷰: 답변 완료 + 답변 대기 모두. 고정 글(이번 주 질문)이 먼저.
    async loungeQuestions() {
      const { data, error } = await client.from("questions_public").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false });
      if (error) fail(error);
      return data || [];
    },
    // 답변 완료 글만 (메인 최근 Q&A)
    async publishedQuestions() {
      const { data, error } = await client.from("questions_public").select("*").eq("status", "published").eq("kind", "question").order("answered_at", { ascending: false });
      if (error) fail(error);
      return data || [];
    },
    async allQuestions() {
      const { data, error } = await client.from("questions").select("*").order("created_at", { ascending: false });
      if (error) fail(error);
      return data || [];
    },
    async submitQuestion(q) {
      const row = { category: q.category, board: q.board || "prep", situation: q.situation, question: q.question, nickname: q.nickname || null, is_private: !!q.is_private, email: q.email || null };
      if (q.poll_options && q.poll_options.length >= 2) { row.kind = "poll"; row.poll_options = q.poll_options; }
      const { error } = await client.from("questions").insert(row);
      if (error) fail(error);
    },
    async insertQuestion(row) {            // 관리자: 직접 올리기 / 이번 주 질문 / 투표
      const { error } = await client.from("questions").insert(row);
      if (error) fail(error);
    },
    async updateQuestion(id, patch) {
      const { error } = await client.from("questions").update(patch).eq("id", id);
      if (error) fail(error);
    },
    async deleteQuestion(id) {
      await client.from("comments").delete().eq("target_type", "question").eq("target_id", id);
      const { error } = await client.from("questions").delete().eq("id", id);
      if (error) fail(error);
    },

    // ---- 투표 ----
    async pollResults(ids) {
      if (!ids.length) return {};
      const { data, error } = await client.from("poll_results").select("*").in("question_id", ids);
      if (error) fail(error);
      const out = {};
      (data || []).forEach((r) => { (out[r.question_id] = out[r.question_id] || {})[r.option_idx] = r.votes; });
      return out;
    },
    pollVote(questionId, optionIdx, voterKey) { return rpc("poll_vote", { p_question_id: questionId, p_option_idx: optionIdx, p_voter_key: voterKey }); },

    // ---- 댓글 ----
    async comments(targetType, targetId) {
      const { data, error } = await client.from("comments_public").select("*").eq("target_type", targetType).eq("target_id", targetId).order("created_at", { ascending: true });
      if (error) fail(error);
      return data || [];
    },
    addComment(targetType, targetId, nickname, pw, body) { return rpc("add_comment", { p_target_type: targetType, p_target_id: targetId, p_nickname: nickname, p_pw: pw, p_body: body }); },
    deleteOwnComment(id, pw) { return rpc("delete_own_comment", { p_id: id, p_pw: pw }); },
    reportComment(id) { return rpc("report_comment", { p_id: id }); },
    async adminComment(targetType, targetId, body) {   // 관리자 댓글 (채용담당자 배지)
      const { error } = await client.from("comments").insert({ target_type: targetType, target_id: targetId, nickname: "서재민", body, is_admin: true });
      if (error) fail(error);
    },
    async allComments(limit = 100) {
      const { data, error } = await client.from("comments").select("*").order("created_at", { ascending: false }).limit(limit);
      if (error) fail(error);
      return data || [];
    },
    async updateComment(id, patch) {
      const { error } = await client.from("comments").update(patch).eq("id", id);
      if (error) fail(error);
    },
    async deleteComment(id) {
      const { error } = await client.from("comments").delete().eq("id", id);
      if (error) fail(error);
    },

    // ---- inquiries (신청 · 문의) ----
    async submitInquiry(i) {
      const { error } = await client.from("inquiries").insert(i);
      if (error) fail(error);
    },
    async allInquiries() {
      const { data, error } = await client.from("inquiries").select("*").order("created_at", { ascending: false });
      if (error) fail(error);
      return data || [];
    },
    async updateInquiry(id, patch) {
      const { error } = await client.from("inquiries").update(patch).eq("id", id);
      if (error) fail(error);
    },
    async deleteInquiry(id) {
      const { error } = await client.from("inquiries").delete().eq("id", id);
      if (error) fail(error);
    },

    // ---- posts (인사이트 글 + LinkedIn 글) ----
    async publishedPosts() {
      const { data, error } = await client.from("posts").select("*").eq("published", true).order("published_at", { ascending: false });
      if (error) fail(error);
      return data || [];
    },
    async allPosts() {
      const { data, error } = await client.from("posts").select("*").order("created_at", { ascending: false });
      if (error) fail(error);
      return data || [];
    },
    async upsertPost(p) {
      const { error } = await client.from("posts").upsert(p);
      if (error) fail(error);
    },
    async deletePost(id) {
      await client.from("comments").delete().eq("target_type", "post").eq("target_id", id);
      const { error } = await client.from("posts").delete().eq("id", id);
      if (error) fail(error);
    },

    // ---- auth (관리자) ----
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) fail(error);
      return data.user;
    },
    async signOut() { await client.auth.signOut(); },
    async currentUser() {
      const { data } = await client.auth.getUser();
      return data ? data.user : null;
    },
  };
})();

/* 공통 유틸 */
window.esc = function (s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
};
window.fmtDate = function (iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};
window.fmtAgo = function (iso) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "방금";
  if (s < 3600) return Math.floor(s / 60) + "분 전";
  if (s < 86400) return Math.floor(s / 3600) + "시간 전";
  if (s < 86400 * 7) return Math.floor(s / 86400) + "일 전";
  return window.fmtDate(iso);
};
window.CATS = { prep: "취업 준비", docs: "서류", linkedin: "링크드인", interview: "면접", job: "이직 · 연봉", foreign: "외국계", etc: "기타" };
window.BOARDS = { prep: "취준", job: "이직", review: "후기", talk: "고민" };
/* LinkedIn 글 주소 → 임베드 주소 (urn:li:activity / share / ugcPost) */
window.linkedinEmbed = function (url) {
  if (!url) return null;
  const m = String(url).match(/urn:li:(activity|share|ugcPost):(\d+)/) || String(url).match(/activity-(\d{15,})/);
  if (!m) return null;
  const kind = m[1] && /^(activity|share|ugcPost)$/.test(m[1]) ? m[1] : "activity";
  const id = m[2] || m[1];
  return `https://www.linkedin.com/embed/feed/update/urn:li:${kind}:${id}`;
};
