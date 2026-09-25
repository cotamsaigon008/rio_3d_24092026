"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { heroContent } from "@/lib/content";
import { BubbleField } from "@/components/ui/BubbleField";
import { Hero3D } from "@/components/ui/Hero3D";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-rio-gradient pb-16 pt-32 dark:bg-rio-gradient-dark sm:pb-24 sm:pt-40">
      <div className="absolute inset-0 bg-rio-radial" aria-hidden="true" />
      <BubbleField count={22} />

      <div className="container-rio relative grid min-w-0 items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="min-w-0">
          <motion.span
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="eyebrow"
          >
            <Sparkles size={14} /> {heroContent.eyebrow}
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mt-5 max-w-xl text-4xl font-extrabold leading-[1.12] tracking-tight text-forest dark:text-cream sm:text-5xl lg:text-[3.4rem]"
          >
            {heroContent.headline}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-6 max-w-lg text-[15.5px] leading-relaxed text-ink/75 dark:text-cream/75"
          >
            {heroContent.sub}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <a href="#san-pham" className="btn-primary">
              Khám phá sản phẩm <ArrowRight size={16} />
            </a>
            <a href="#quy-trinh" className="btn-ghost">
              Xem quy trình lên men
            </a>
          </motion.div>

          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="mt-12 grid max-w-lg min-w-0 grid-cols-3 gap-4 sm:gap-6 border-t border-forest/10 pt-8 dark:border-cream/10"
          >
            {heroContent.stats.map((s) => (
              <div key={s.label} className="min-w-0">
                <dt className="font-display text-2xl font-extrabold text-forest dark:text-gold sm:text-3xl">
                  {s.value}
                </dt>
                <dd className="mt-1 text-xs leading-snug text-ink/60 dark:text-cream/60">
                  {s.label}
                </dd>
              </div>
            ))}
          </motion.dl>
        </div>

        {/* Sân khấu 3D: quầng xanh rừng phía sau, sản phẩm tách nền đứng trên sàn và nhô ra khỏi quầng.
            isolate để tạo stacking context riêng trên iOS. */}
        <div className="relative mx-auto h-[460px] w-full min-w-0 max-w-[560px] isolate sm:h-[600px] lg:h-[640px]">
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-[49%] aspect-square w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 34% 26%, #2F6C53 0%, #1B4534 42%, #0C2019 100%)",
              boxShadow:
                "0 50px 110px -34px rgba(12,32,25,0.6), inset 0 0 0 1px rgba(255,255,255,0.07)",
            }}
          />
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-[49%] aspect-square w-[94%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/40"
          />
          <Hero3D className="absolute inset-0" />
        </div>
      </div>
    </section>
  );
}
