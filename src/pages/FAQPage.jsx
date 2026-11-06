import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBolt,
  FaWhatsapp,
  FaInstagram,
  FaLinkedinIn,
  FaYoutube,
  FaFacebookF,
  FaCrown,
  FaQuestionCircle,
  FaSearch,
  FaEnvelope,
  FaGraduationCap,
  FaCreditCard,
  FaUsers,
  FaUniversity,
  FaUserCog,
  FaExclamationTriangle,
  FaHeadset,
  FaRocket,
} from "react-icons/fa";
import { SiX, SiTiktok } from "react-icons/si";
import Logo from "../images/Logo";
import Accordion from "../components/Accordion";
import { FAQ_CATEGORIES, FAQ_ITEMS } from "../data/faqData";
import { useUniversities } from "../hooks/useUniversities";
import useDocumentTitle from "../hooks/useDocumentTitle";

const CATEGORY_ICONS = {
  all: <FaQuestionCircle />,
  "getting-started": <FaRocket />,
  premium: <FaCrown />,
  "exams-practice": <FaGraduationCap />,
  payments: <FaCreditCard />,
  referrals: <FaUsers />,
  universities: <FaUniversity />,
  account: <FaUserCog />,
  technical: <FaExclamationTriangle />,
  support: <FaHeadset />,
};

const FAQPage = () => {
  useDocumentTitle(
    "FAQ | QuizBolt — Frequently Asked Questions",
  );
  const navigate = useNavigate();
  const { universities } = useUniversities();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const ogTitle =
      "FAQ | QuizBolt — Frequently Asked Questions";
    const ogDescription =
      "Find answers to all your QuizBolt questions: Premium pricing, university support, exam practice modes, referrals, payments, technical help, and contact support.";

    const updateMeta = (selector, attr, value) => {
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        const [propName, propVal] = selector.slice(1, -1).split("=");
        const [, cleanVal] = propVal.split('"');
        el.setAttribute(propName, cleanVal);
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    updateMeta(
      'meta[name="description"]',
      "content",
      ogDescription,
    );
    updateMeta(
      'meta[property="og:title"]',
      "content",
      ogTitle,
    );
    updateMeta(
      'meta[property="og:description"]',
      "content",
      ogDescription,
    );
    updateMeta(
      'meta[property="og:type"]',
      "content",
      "website",
    );
    updateMeta(
      'meta[name="twitter:card"]',
      "content",
      "summary_large_image",
    );
    updateMeta(
      'meta[name="twitter:title"]',
      "content",
      ogTitle,
    );
    updateMeta(
      'meta[name="twitter:description"]',
      "content",
      ogDescription,
    );
  }, []);

  const jsonLd = useMemo(() => {
    const mainEntity = FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    }));

    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity,
    };
  }, []);

  useEffect(() => {
    const existing = document.getElementById("quizbolt-faq-jsonld");
    if (existing) existing.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "quizbolt-faq-jsonld";
    script.text = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    return () => {
      const el = document.getElementById("quizbolt-faq-jsonld");
      if (el) el.remove();
    };
  }, [jsonLd]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let items = FAQ_ITEMS;

    if (activeCategory !== "all") {
      items = items.filter((i) => i.category === activeCategory);
    }

    if (q.length > 0) {
      items = items.filter(
        (i) =>
          i.question.toLowerCase().includes(q) ||
          i.answer.toLowerCase().includes(q),
      );
    }

    return items;
  }, [activeCategory, searchQuery]);

  const visibleCategoryCount = useMemo(() => {
    const counts = {};
    FAQ_CATEGORIES.forEach((c) => {
      counts[c.id] =
        c.id === "all"
          ? FAQ_ITEMS.length
          : FAQ_ITEMS.filter((i) => i.category === c.id).length;
    });
    return counts;
  }, []);

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
            <a
              onClick={() => navigate("/about")}
              className="hover:text-blue-600 cursor-pointer"
            >
              About
            </a>
            <a
              onClick={() => navigate("/landing")}
              className="hover:text-blue-600 cursor-pointer"
            >
              Features
            </a>
            <a
              onClick={() => navigate("/landing")}
              className="hover:text-blue-600 cursor-pointer"
            >
              Premium
            </a>
            <span className="text-blue-600 dark:text-blue-400">FAQ</span>
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
      <section className="pt-20 md:pt-28 pb-12 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 px-4 py-2 rounded-full">
            <FaQuestionCircle className="text-blue-600 dark:text-blue-400 text-xs" />
            <span className="text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-[0.2em]">
              Help Center
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1]">
            Frequently Asked{" "}
            <span className="text-blue-600 dark:text-blue-400">
              Questions
            </span>
          </h1>
          <p className="text-lg text-slate-500 dark:text-gray-400 font-medium max-w-2xl mx-auto leading-relaxed">
            Everything you need to know about QuizBolt — from getting started
            and Premium access, to exam practice, university support,
            referrals, payments, and how to reach our team.
          </p>

          {/* SEARCH */}
          <div className="max-w-2xl mx-auto w-full pt-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <FaSearch className="text-slate-400 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 text-lg transition-colors" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search questions, answers, or topics…"
                className="w-full pl-14 pr-5 py-5 rounded-[1.5rem] bg-white dark:bg-gray-900 border-2 border-slate-100 dark:border-gray-800 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-sm hover:shadow-md text-sm md:text-base font-medium"
                aria-label="Search FAQ"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 font-bold text-xs px-2"
                  aria-label="Clear search"
                >
                  Clear
                </button>
              )}
            </div>
            {(activeCategory !== "all" || searchQuery) && (
              <p className="text-xs font-bold text-slate-400 mt-3">
                Showing {filteredItems.length}{" "}
                {filteredItems.length === 1 ? "result" : "results"}
                {searchQuery && <> for “{searchQuery}”</>}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* CATEGORY TABS */}
      <section className="px-6 pb-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap justify-center gap-2 md:gap-3">
            {FAQ_CATEGORIES.map((cat) => {
              const active = activeCategory === cat.id;
              const count = visibleCategoryCount[cat.id] || 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs md:text-sm font-black transition-all active:scale-95 whitespace-nowrap ${
                    active
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg"
                      : "bg-white dark:bg-gray-900 text-slate-600 dark:text-gray-300 border border-slate-100 dark:border-gray-800 hover:border-slate-200 dark:hover:border-gray-700 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  <span
                    className={`text-base ${
                      active
                        ? "text-white dark:text-slate-900"
                        : "text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {CATEGORY_ICONS[cat.id] || <FaQuestionCircle />}
                  </span>
                  <span>{cat.shortLabel}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      active
                        ? "bg-white/20 dark:bg-slate-900/10"
                        : "bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ ACCORDION */}
      <section className="px-6 pb-24">
        <div className="max-w-3xl mx-auto">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6 bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-[2.5rem]">
              <div className="size-16 bg-slate-100 dark:bg-gray-800 rounded-3xl flex items-center justify-center mb-6">
                <FaSearch className="text-slate-300 dark:text-gray-600 text-2xl" />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">
                No results found
              </h3>
              <p className="text-sm text-slate-400 dark:text-gray-500 font-medium max-w-sm mb-6 leading-relaxed">
                We couldn't find anything matching your search. Try a different
                keyword or browse a category above.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                }}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-blue-200 dark:shadow-none"
              >
                Reset search & view all
              </button>
            </div>
          ) : (
            <>
              {activeCategory === "all"
                ? FAQ_CATEGORIES.filter((c) => c.id !== "all").map((cat) => {
                    const catItems = filteredItems.filter(
                      (i) => i.category === cat.id,
                    );
                    if (catItems.length === 0) return null;
                    return (
                      <div key={cat.id} className="mb-14 scroll-mt-32">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="size-10 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
                            {CATEGORY_ICONS[cat.id]}
                          </div>
                          <h2 className="text-lg md:text-xl font-black tracking-tight">
                            {cat.label}
                          </h2>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-gray-800 px-2.5 py-1 rounded-full">
                            {catItems.length}
                          </span>
                        </div>
                        <Accordion
                          items={catItems}
                          allowMultiple={false}
                          gapClass="gap-3"
                        />
                      </div>
                    );
                  })
                : (
                  <Accordion
                    items={filteredItems}
                    allowMultiple={false}
                    gapClass="gap-3"
                  />
                )}
            </>
          )}
        </div>
      </section>

      {/* STILL NEED HELP CTA */}
      <section className="px-6 pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="relative group overflow-hidden bg-slate-900 dark:bg-white rounded-[3rem] p-10 md:p-16 text-center shadow-2xl">
            <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
              <FaBolt className="text-white dark:text-black text-[180px]" />
            </div>
            <div className="relative z-10 max-w-2xl mx-auto space-y-8">
              <div className="inline-flex items-center gap-2 bg-white/10 dark:bg-blue-50 border border-white/15 dark:border-blue-100 px-4 py-2 rounded-full">
                <FaHeadset className="text-white dark:text-blue-600 text-xs" />
                <span className="text-white/80 dark:text-blue-700 text-[10px] font-black uppercase tracking-[0.2em]">
                  We're here to help
                </span>
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-white dark:text-slate-950 tracking-tight leading-tight">
                Still need help?
              </h2>
              <p className="text-base md:text-lg text-slate-300 dark:text-slate-500 font-medium leading-relaxed max-w-xl mx-auto">
                Couldn't find the answer you were looking for? No worries — our
                team is just a message away. Reach out directly on WhatsApp or
                send an email and we'll get back to you within 24 hours.
              </p>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-2">
                <a
                  href="https://wa.me/2347015585397"
                  target="_blank"
                  rel="noreferrer"
                  className="group/btn inline-flex items-center gap-3 bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-2xl font-black text-base shadow-xl shadow-green-500/20 dark:shadow-green-500/10 transition-all active:scale-95"
                >
                  <FaWhatsapp className="text-xl group-hover/btn:scale-110 transition-transform" />
                  Contact WhatsApp
                </a>
                <a
                  href="mailto:support@quizbolt.net"
                  className="group/btn inline-flex items-center gap-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-8 py-4 rounded-2xl font-black text-base hover:bg-blue-50 dark:hover:bg-slate-800 transition-all active:scale-95 border border-slate-100 dark:border-slate-800"
                >
                  <FaEnvelope className="text-base group-hover/btn:scale-110 transition-transform" />
                  Send Email
                </a>
                <button
                  onClick={() => navigate("/about")}
                  className="group/btn inline-flex items-center gap-3 bg-transparent text-white dark:text-slate-900 hover:text-blue-200 dark:hover:text-blue-600 px-8 py-4 rounded-2xl font-black text-base transition-all active:scale-95"
                >
                  About Us <span className="group-hover/btn:translate-x-1 transition-transform">&rarr;</span>
                </button>
              </div>
              <p className="text-xs text-white/50 dark:text-slate-400 font-medium pt-4">
                Average response time: A few minutes on WhatsApp · 24 hours on
                email
              </p>
            </div>
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
                <span className="text-blue-600 font-black">FAQ</span>
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
                <button
                  onClick={() => navigate("/privacy")}
                  className="hover:text-blue-600"
                >
                  Privacy Policy
                </button>
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

export default FAQPage;
