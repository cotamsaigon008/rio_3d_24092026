"use client";

import { useEffect, useState } from "react";
import { Menu, X, Moon, Sun } from "lucide-react";
import { nav, site } from "@/lib/content";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <header
      className={`fixed inset-x-0 top-[36px] sm:top-10 z-50 min-w-0 transition-all duration-300 ${
        scrolled ? "py-1.5 sm:py-2" : "py-3 sm:py-4"
      }`}
    >
      <div className="container-rio min-w-0">
        <div
          className={`flex min-w-0 items-center justify-between gap-2 rounded-full px-3.5 py-2 sm:px-5 sm:py-2.5 transition-all duration-300 ${
            scrolled ? "glass shadow-glass dark:shadow-glass-dark" : "glass sm:bg-transparent sm:border-transparent sm:backdrop-blur-none"
          }`}
        >
          <a href="#" className="flex min-w-0 items-center gap-2 font-display text-lg sm:text-xl font-extrabold tracking-tight text-forest dark:text-cream">
            <span className="flex h-7 w-7 shrink-0 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-forest text-xs sm:text-sm text-cream dark:bg-leaf">
              R
            </span>
            <span className="truncate">{site.name}</span>
          </a>

          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-3.5 py-2 text-[13.5px] font-medium text-ink/75 transition-colors hover:bg-forest/5 hover:text-forest dark:text-cream/70 dark:hover:bg-cream/10 dark:hover:text-cream"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setDark((d) => !d)}
              aria-label={dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
              className="flex h-8 w-8 shrink-0 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-forest/15 text-forest transition-colors hover:bg-forest/5 dark:border-cream/20 dark:text-cream dark:hover:bg-cream/10"
            >
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            {/* CTA chỉ hiện từ md trở lên — trên mobile giữ header gọn
                (ảnh lỗi cho thấy bản deploy cũ hiện pill này trên mobile
                gây chật, tràn header). CTA mobile nằm trong menu xổ. */}
            <a href="#lien-he" className="btn-primary !hidden md:!inline-flex text-xs sm:text-sm px-4 py-2 sm:px-7 sm:py-3.5 whitespace-nowrap">
              Liên hệ đặt hàng
            </a>
            <button
              onClick={() => setOpen((o) => !o)}
              aria-label="Mở menu"
              className="flex h-8 w-8 shrink-0 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-forest/15 text-forest lg:hidden dark:border-cream/20 dark:text-cream"
            >
              {open ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="glass mt-2 max-h-[calc(100dvh-140px)] overflow-y-auto rounded-3xl p-4 shadow-glass lg:hidden">
            <nav className="flex flex-col gap-1">
              {nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-2xl px-4 py-3 text-sm font-medium text-ink/80 hover:bg-forest/5 dark:text-cream/80 dark:hover:bg-cream/10"
                >
                  {item.label}
                </a>
              ))}
              <a href="#lien-he" onClick={() => setOpen(false)} className="btn-primary mt-2">
                Liên hệ đặt hàng
              </a>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
