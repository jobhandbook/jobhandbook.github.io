document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      nav.classList.toggle("open");
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => nav.classList.remove("open"));
    });
  }

  const normalize = (path) =>
    (path.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";

  const current = normalize(location.pathname);
  document.querySelectorAll(".main-nav a").forEach((link) => {
    const href = normalize(link.getAttribute("href"));
    if (href === current) {
      link.classList.add("active");
    }
  });
});
