import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBolt,
  FaWhatsapp,
  FaInstagram,
  FaLinkedinIn,
  FaYoutube,
  FaFacebookF,
  FaEnvelope,
  FaArrowUp,
  FaCalendarAlt,
} from "react-icons/fa";
import { FaShieldHalved } from "react-icons/fa6";
import { SiX, SiTiktok } from "react-icons/si";
import Logo from "../images/Logo";
import LegalSection from "../components/LegalSection";
import { PRIVACY_SECTIONS, PRIVACY_LAST_UPDATED } from "../data/privacyData";
import { useUniversities } from "../hooks/useUniversities";
import useDocumentTitle from "../hooks/useDocumentTitle";

const PrivacyPage = () => {
  useDocumentTitle("Privacy Policy | QuizBolt");
  const navigate = useNavigate();
  const { universities } = useUniversities();

  const [activeId, setActiveId] = useState(PRIVACY_SECTIONS[0]?.id || "");
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const ogTitle = "Privacy Policy | QuizBolt";
    const ogDescription =
      "The QuizBolt Privacy Policy — exactly what information we collect (profile, university level, exam attempts, bookmarks, referrals, GA4 analytics), where it's stored (Supabase, Cloudinary, localStorage), how it's used, how long we keep it, and how to delete it.";

    const updateMeta = (selector, attr, value) => {
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        const match = selector.match(/^meta\[(\w+)="([^"]+)"\]$/);
        if (match) {
          const [, attrName, attrVal] = match;
          el.setAttribute(attrName, attrVal);
        }
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    updateMeta('meta[name="description"]', "content", ogDescription);
    updateMeta('meta[property="og:title"]', "content", ogTitle);
    updateMeta('meta[property="og:description"]', "content", ogDescription);
    updateMeta('meta[property="og:type"]', "content", "website");
    updateMeta('meta[name="twitter:card"]', "content", "summary_large_image");
    updateMeta('meta[name="twitter:title"]', "content", ogTitle);
    updateMeta('meta[name="twitter:description"]', "content", ogDescription);
  }, []);

  const handleScroll = useCallback(() => {
    setShowBackToTop(window.scrollY > 600);

    const scrollPos = window.scrollY + 160;
    let current = PRIVACY_SECTIONS[0]?.id || "";

    for (const section of PRIVACY_SECTIONS) {
      const el = document.getElementById(section.id);
      if (el && el.offsetTop <= scrollPos) {
        current = section.id;
      } else {
        break;
      }
    }

    setActiveId(current);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const scrollToSection = useCallback((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 112;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, []);

  const tocItems = useMemo(
    () =>
      PRIVACY_SECTIONS.map((s) => ({
        id: s.id,
        number: s.number,
        title: s.title,
      })),
    [],
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-gray-100 selection:bg-blue-100 dark:selection:bg-blue-900/30 transition-colors duration-300">
      {/* NAV */}
      <nav className="py-6 px-6 border-b border-slate-100 dark:border-gray-800 bg-white/50 dark:bg-gray-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate("/landing")}
          >
            <Logo className="w-8 h-8 text-blue-600" />
            <span className="text-xl font-black tracking-tighter">
              QuizBolt
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
            <button
              onClick={() => navigate("/about")}
              className="hover:text-blue-600 transition-colors"
            >
              About
            </button>
            <button
              onClick={() => navigate("/landing")}
              className="hover:text-blue-600 transition-colors"
            >
              Features
            </button>
            <button
              onClick={() => navigate("/faq")}
              className="hover:text-blue-600 transition-colors"
            >
              FAQ
            </button>
            <button
              onClick={() => navigate("/terms")}
              className="hover:text-blue-600 transition-colors"
            >
              Terms
            </button>
          </div>
          <button
            onClick={() => navigate("/signup")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-2xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-blue-200 dark:shadow-none"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-20 md:pt-28 pb-14 px-6 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-[0.04] pointer-events-none">
          <FaShieldHalved className="absolute -top-12 left-2 text-blue-600 dark:text-blue-400 text-[240px]" />
          <FaBolt className="absolute bottom-0 -right-6 text-slate-900 dark:text-white text-[180px] rotate-12" />
        </div>

        <div className="max-w-4xl mx-auto text-center space-y-7">
          <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 px-4 py-2 rounded-full">
            <FaShieldHalved className="text-blue-600 dark:text-blue-400 text-xs" />
            <span className="text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-[0.2em]">
              Privacy
            </span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1]">
            Privacy{" "}
            <span className="text-blue-600 dark:text-blue-400">Policy</span>
          </h1>

          <p className="text-lg text-slate-500 dark:text-gray-400 font-medium max-w-2xl mx-auto leading-relaxed">
            At QuizBolt, student privacy comes first. This policy explains
            exactly what information we collect to run the platform, how we use
            it to power your study experience, where it's stored, how long we
            keep it, and every control you have over it.
          </p>

          <div className="inline-flex items-center gap-3 text-xs font-bold text-slate-400 bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 px-5 py-3 rounded-2xl shadow-sm">
            <FaCalendarAlt className="text-blue-500 text-sm" />
            <span className="uppercase tracking-[0.18em] text-[10px]">
              Last Updated
            </span>
            <span className="text-slate-700 dark:text-gray-200 text-sm font-black tracking-tight">
              {PRIVACY_LAST_UPDATED}
            </span>
          </div>
        </div>
      </section>

      {/* CONTENT: 2-col with sticky TOC on desktop */}
      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[280px_minmax(0,1fr)] gap-10 xl:gap-16">
          {/* TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-32 space-y-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-3 px-4">
                  Table of Contents
                </p>
                <nav
                  aria-label="Table of contents"
                  className="space-y-1 border-l-2 border-slate-100 dark:border-gray-800"
                >
                  {tocItems.map((item) => {
                    const isActive = activeId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => scrollToSection(item.id)}
                        className={`group w-full relative text-left px-4 py-2.5 rounded-r-2xl transition-all ${
                          isActive
                            ? "bg-blue-50 dark:bg-blue-900/15"
                            : "hover:bg-slate-100 dark:hover:bg-gray-900"
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-[-2px] top-1.5 bottom-1.5 w-[3px] rounded-full bg-blue-600 dark:bg-blue-400" />
                        )}
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`shrink-0 text-[10px] font-black tracking-wider w-5 ${
                              isActive
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-slate-300 dark:text-gray-700 group-hover:text-slate-400"
                            }`}
                          >
                            {item.number.padStart(2, "0")}
                          </span>
                          <span
                            className={`truncate text-xs font-black leading-tight ${
                              isActive
                                ? "text-slate-900 dark:text-white"
                                : "text-slate-500 dark:text-gray-400 group-hover:text-slate-700 dark:group-hover:text-gray-200"
                            }`}
                          >
                            {item.title}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </div>
              <div className="rounded-3xl border border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                  Questions?
                </p>
                <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 mb-4 leading-relaxed">
                  Unsure how any of this applies to your account? Ask us
                  directly — we're happy to explain in plain English.
                </p>
                <a
                  href="https://wa.me/2347015585397"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-2xl font-black text-xs transition-all active:scale-95"
                >
                  <FaWhatsapp /> Message us
                </a>
              </div>
            </div>
          </aside>

          {/* BODY */}
          <div className="min-w-0">
            {/* Mobile TOC chip bar */}
            <div className="lg:hidden mb-10 -mx-1 overflow-x-auto no-scrollbar pb-2">
              <div className="flex gap-2 min-w-max px-1">
                {tocItems.map((item) => {
                  const isActive = activeId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollToSection(item.id)}
                      className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[11px] font-black border transition-all ${
                        isActive
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow"
                          : "bg-white dark:bg-gray-900 text-slate-500 dark:text-gray-400 border-slate-100 dark:border-gray-800 hover:border-slate-200"
                      }`}
                    >
                      <span
                        className={
                          isActive
                            ? "text-white/70 dark:text-slate-900/70"
                            : "text-blue-600 dark:text-blue-400"
                        }
                      >
                        {item.number}
                      </span>
                      {item.title}
                    </button>
                  );
                })}
              </div>
            </div>

            <article className="bg-white dark:bg-gray-900/60 rounded-[2.5rem] border border-slate-100 dark:border-gray-800 shadow-sm p-6 md:p-10 xl:p-14">
              {PRIVACY_SECTIONS.map((s) => (
                <LegalSection
                  key={s.id}
                  id={s.id}
                  number={s.number}
                  title={s.title}
                  paragraphs={s.paragraphs}
                  bullets={s.bullets}
                  paragraphsAfter={s.paragraphsAfter}
                />
              ))}
            </article>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-20 border-t border-slate-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Logo className="w-6 h-6 text-blue-600" />
              <span className="text-lg font-black tracking-tighter">
                QuizBolt
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              The ultimate academic companion for university students mastering
              their courses through interactive CBT preparation.
            </p>
            <div className="flex flex-wrap gap-3">
              <SocialLink
                url="https://www.instagram.com/codejeffrey18/"
                icon={<FaInstagram />}
                color="hover:bg-pink-600"
              />
              <SocialLink
                url="https://x.com/Jappy682"
                icon={<SiX />}
                color="hover:bg-gray-900"
              />
              <SocialLink
                url="https://whatsapp.com/channel/0029Vb6t7rnKrWQx4oL6m31f"
                icon={<FaWhatsapp />}
                color="hover:bg-green-500"
              />
              <SocialLink
                url="https://www.tiktok.com/@codejeffrey18"
                icon={<SiTiktok />}
                color="hover:bg-gray-900"
              />
              <SocialLink
                url="https://www.youtube.com/@codejeffrey18"
                icon={<FaYoutube />}
                color="hover:bg-red-500"
              />
              <SocialLink
                url="https://www.linkedin.com/in/jeffrey-austin-110074383"
                icon={<FaLinkedinIn />}
                color="hover:bg-blue-500"
              />
              <SocialLink
                url="https://www.facebook.com/share/17RabkxuWY/"
                icon={<FaFacebookF />}
                color="hover:bg-blue-600"
              />
            </div>
          </div>
          <div>
            <h4 className="font-black text-xs uppercase tracking-[0.2em] mb-6">
              Links
            </h4>
            <ul className="space-y-4 text-sm font-bold text-slate-500 dark:text-gray-400">
              <li>
                <button
                  onClick={() => navigate("/landing")}
                  className="hover:text-blue-600"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate("/about")}
                  className="hover:text-blue-600"
                >
                  About Us
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate("/faq")}
                  className="hover:text-blue-600"
                >
                  FAQ
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate("/terms")}
                  className="hover:text-blue-600"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <span className="text-blue-600 font-black">Privacy Policy</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-black text-xs uppercase tracking-[0.2em] mb-6">
              Universities
            </h4>
            <ul className="space-y-3 text-sm font-medium text-slate-500 dark:text-gray-400">
              {universities.map((u) => (
                <li key={u.id} className="flex items-center gap-2">
                  <div className="size-1.5 bg-blue-600 rounded-full shrink-0" />
                  {u.name}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-black text-xs uppercase tracking-[0.2em] mb-6">
              Contact
            </h4>
            <div className="space-y-4">
              <a
                href="https://wa.me/2347015585397"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 text-sm font-bold text-slate-500 dark:text-gray-400 hover:text-green-500 transition-colors"
              >
                <FaWhatsapp className="text-green-500" /> +234 701 558 5397
              </a>
              <a
                href="mailto:support@quizbolt.net"
                className="flex items-center gap-3 text-sm font-bold text-slate-500 dark:text-gray-400 hover:text-blue-600 transition-colors"
              >
                <FaEnvelope className="text-blue-500" /> support@quizbolt.net
              </a>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-slate-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-400 font-medium">
            © {new Date().getFullYear()} QuizBolt. All rights reserved.
          </p>
          <p className="text-xs text-slate-400 font-medium">
            Built with ❤️ for Nigerian university students.
          </p>
        </div>
      </footer>

      {/* BACK TO TOP */}
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Back to top"
        className={`fixed bottom-6 right-6 z-40 size-14 rounded-3xl bg-blue-600 text-white shadow-xl shadow-blue-600/25 dark:shadow-blue-500/10 hover:bg-blue-700 transition-all flex items-center justify-center active:scale-95 ${
          showBackToTop
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <FaArrowUp />
      </button>
    </div>
  );
};

const SocialLink = ({ url, icon, color }) => (
  <a
    href={url}
    target="_blank"
    rel="noreferrer"
    className={`size-10 bg-slate-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-slate-600 dark:text-gray-400 ${color} hover:text-white transition-all`}
  >
    {icon}
  </a>
);

export default PrivacyPage;
