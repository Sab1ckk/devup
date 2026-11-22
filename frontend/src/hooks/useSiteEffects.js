import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { initPalette, restoreSavedPalette } from "../palette";
import { useUI } from "../components/UI";
export default function useSiteEffects() {
  const location = useLocation(),
    navigate = useNavigate(),
    { dialog, open, close } = useUI();
  useEffect(() => {
    const d = dialog && document.getElementById(dialog);
    if (
      d &&
      d.tagName === "DIALOG" &&
      !["auth", "detail", "claim", "quick-chat", "portfolio-detail"].includes(dialog) && !dialog.startsWith("admin-") &&
      !d.open
    )
      d.showModal();
  }, [dialog]);
  useEffect(() => {
    document.body.classList.add("v03");
    initPalette();
    const nav = document.querySelector("#site-navigation"),
      menu = document.querySelector(".menu-btn");
    function closeMenu() {
      nav.classList.remove("open");
      menu.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-label", "Открыть меню");
    }
    const palette = document.querySelector("#pal");
    const paletteButton = document.querySelector("#pal-fab");
    function closePalette() {
      if (palette) palette.hidden = true;
      paletteButton?.setAttribute("aria-expanded", "false");
    }
    function outsidePalette(e) {
      if (!palette?.hidden && !palette?.contains(e.target) && !paletteButton?.contains(e.target)) closePalette();
    }
    function click(e) {
      if (e.target.closest(".menu-btn")) {
        const expanded = nav.classList.toggle("open");
        menu.setAttribute("aria-expanded", String(expanded));
        menu.setAttribute(
          "aria-label",
          expanded ? "Закрыть меню" : "Открыть меню",
        );
      }
      const opener = e.target.closest("[data-open]");
      if (opener) open(opener.dataset.open);
      const closer = e.target.closest("[data-close]");
      if (closer) {
        closer.closest("dialog")?.close();
        close();
      }
      if (e.target.tagName === "DIALOG") {
        const r = e.target.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        ) {
          e.target.close();
          close();
        }
      }
      const anchor = e.target.closest("a");
      if (
        !e.defaultPrevented && anchor &&
        anchor.origin === window.location.origin &&
        !anchor.hasAttribute("download") &&
        !anchor.target &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey &&
        e.button === 0
      ) {
        if (anchor.getAttribute("href")?.startsWith("#")) return;
        e.preventDefault();
        closeMenu();
        close();
        navigate(anchor.pathname + anchor.search + anchor.hash);
      }
    }
    const key = (e) => {
      if (e.key === "Escape") {
        if (nav.classList.contains("open")) {
          closeMenu();
          menu.focus();
        }
        closePalette();
        close();
      }
    };
    const resize = () =>
      document.documentElement.style.setProperty(
        "--viewport-width",
        `${document.documentElement.clientWidth}px`,
      );
    const header = document.querySelector(".site-header");
    const updateHeader = () => document.documentElement.style.setProperty("--header-bottom", Math.max(0, header?.getBoundingClientRect().bottom ?? 0) + "px");
    const headerObserver = new ResizeObserver(updateHeader);
    if (header) headerObserver.observe(header);
    window.addEventListener("scroll", updateHeader, {passive:true});
    updateHeader();
    resize();
    document.addEventListener("pointerdown", outsidePalette);
    document.addEventListener("click", outsidePalette);
    document.addEventListener("click", click);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", resize);
    window.addEventListener("storage", restoreSavedPalette);
    window.addEventListener("pageshow", restoreSavedPalette);
    return () => {
      headerObserver.disconnect();
      window.removeEventListener("scroll", updateHeader);
      document.removeEventListener("pointerdown", outsidePalette);
      document.removeEventListener("click", outsidePalette);
      document.removeEventListener("click", click);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", resize);
      window.removeEventListener("storage", restoreSavedPalette);
      window.removeEventListener("pageshow", restoreSavedPalette);
    };
  }, [navigate, open, close]);
  useEffect(() => {
    const titles = {
      "/": "Главная",
      "/services": "Услуги",
      "/portfolio": "Портфолио",
      "/reviews": "Отзывы",
      "/order": "Заявка",
      "/chat": "Чат",
      "/cabinet": "Кабинет",
    };
    document.title = `${location.pathname.startsWith("/admin") ? "Админ-панель" : titles[location.pathname] || "Страница не найдена"} · DEVUP`;
    document.querySelectorAll(".nav a").forEach((a) => {
      a.removeAttribute("aria-current");
      if (a.pathname === location.pathname)
        a.setAttribute("aria-current", "page");
    });
    if (location.hash)
      requestAnimationFrame(() =>
        document.getElementById(location.hash.slice(1))?.scrollIntoView(),
      );
    else window.scrollTo(0, 0);
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const observer = !reduced
      ? new IntersectionObserver(
          (entries) =>
            entries.forEach((e) => {
              if (e.isIntersecting) {
                e.target.classList.add("reveal-enter");
                observer.unobserve(e.target);
              }
            }),
          { threshold: 0.08 },
        )
      : null;
    document
      .querySelectorAll(".rv,.pagehd,.brief-section,.chat-page")
      .forEach((el) => observer?.observe(el));
    let pointer;
    function updateGlow() {
      if (!pointer) return;
      const [x,y] = pointer;
      const card = document.elementFromPoint(x,y)?.closest(".svc,.pfg .card,.project-block");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--glow-x", (x - r.left - card.clientLeft) + "px");
      card.style.setProperty("--glow-y", (y - r.top - card.clientTop) + "px");
    }
    const move = (e) => {
      if (reduced || e.pointerType === "touch") return;
      const button = e.target.closest("[data-magnet]");
      if (button) {
        const r = button.getBoundingClientRect();
        button.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.08}px,${(e.clientY - r.top - r.height / 2) * 0.08}px)`;
      }
      pointer = [e.clientX,e.clientY];
      updateGlow();
    };
    const out = (e) => {
      const button = e.target.closest("[data-magnet]");
      if (button && !button.contains(e.relatedTarget))
        button.style.transform = "";
    };
    window.addEventListener("scroll", updateGlow, { passive: true });
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerout", out);
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", updateGlow);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerout", out);
    };
  }, [location.pathname, location.hash]);
}
