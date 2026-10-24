/* ==========================================================
   DB 레이어 — Supabase 래퍼. 설정이 없으면 DB.ready === false.
   테이블: settings / questions / inquiries / posts (supabase/schema.sql 참고)
   ========================================================== */
window.DB = (function () {
  const cfg = window.CONFIG || {};
  const ready = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const client = ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  function fail(e) { console.error("[DB]", e); throw e; }

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

    // ---- questions ----
    async publishedQuestions() {
      const { data, error } = await client.from("questions").select("*").eq("status", "published").order("answered_at", { ascending: false });
      if (error) fail(error);
      return data || [];
    },
    async allQuestions() {
      const { data, error } = await client.from("questions").select("*").order("created_at", { ascending: false });
      if (error) fail(error);
      return data || [];
    },
    async submitQuestion(q) {
      const { error } = await client.from("questions").insert({ category: q.category, situation: q.situation, question: q.question, nickname: q.nickname || null, is_private: !!q.is_private, email: q.email || null });
      if (error) fail(error);
    },
    async updateQuestion(id, patch) {
      const { error } = await client.from("questions").update(patch).eq("id", id);
      if (error) fail(error);
    },
    async deleteQuestion(id) {
      const { error } = await client.from("questions").delete().eq("id", id);
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

    // ---- posts (인사이트 글) ----
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
window.CATS = { prep: "취업 준비", docs: "서류", linkedin: "링크드인", interview: "면접", job: "이직 · 연봉", foreign: "외국계", etc: "기타" };
