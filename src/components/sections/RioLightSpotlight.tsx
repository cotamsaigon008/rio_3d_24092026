"use client";

import { Droplet, Leaf, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { Product3D } from "@/components/ui/Product3D";

/**
 * Trang giới thiệu riêng cho RIO Light Đào & Brandy — chuyển thể từ một mẫu landing page dạng
 * "hero tối màu, sản phẩm lớn ở giữa, 3 thẻ tính năng bên cạnh". Thay vì video xoáy chất lỏng của mẫu
 * gốc, phần giữa dùng chính engine 3D dùng chung của trang (xem src/lib/rio3d.ts) để hiển thị lon thật,
 * xoay được — nên nằm trọn trong cùng một hệ thống 3D với Hero và các card sản phẩm phía trên.
 */
const FEATURES = [
  {
    icon: Leaf,
    title: "Chiết Xuất Đào Thật",
    desc: "Hoà quyện từ đào chín mọng và brandy êm dịu, cho vị ngọt tự nhiên, không gắt.",
  },
  {
    icon: Droplet,
    title: "Sảng Khoái Tức Thì",
    desc: "Vị chua thanh nhẹ, sủi bọt tự nhiên — dùng lạnh càng cuốn, hợp mọi cuộc vui.",
  },
  {
    icon: ShieldCheck,
    title: "Nhẹ Nhàng Hơn",
    desc: "Nồng độ cồn nhẹ khoảng 3% vol, không phẩm màu tổng hợp, không chất bảo quản.",
  },
] as const;

export function RioLightSpotlight() {
  return (
    <section
      id="rio-light-dao"
      className="relative overflow-hidden bg-rio-gradient-dark py-24 sm:py-32"
    >
      <div className="absolute inset-0 bg-rio-radial" aria-hidden="true" />
      {/* quầng sáng hồng đào phía sau lon, thay cho phông nền đen của bản gốc */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFA3BC] opacity-[0.16] blur-[140px]"
      />

      <div className="container-rio relative grid items-center gap-y-16 lg:grid-cols-12 lg:gap-x-8">
        {/* trái: tiêu đề */}
        <Reveal className="lg:col-span-5">
          <span className="inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">
            Powerful Drinks, Built For Every Adventure.
          </span>
          <h2 className="mt-4 font-display text-[2.4rem] font-extrabold uppercase leading-[1.08] tracking-tight text-cream sm:text-[3.1rem] lg:text-[3.3rem]">
            Tràn đầy năng lượng,
            <br />
            sẵn sàng cho
            <br />
            mọi cuộc phiêu lưu.
          </h2>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-cream/70">
            RIO Light Đào &amp; Brandy — lon 330ml nồng độ nhẹ, mang trọn hương đào chín hoà cùng
            brandy êm dịu, cho những khoảnh khắc thư giãn dễ chịu.
          </p>
          <a
            href="#lien-he"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-gold px-7 py-3.5 text-sm font-semibold text-forest-dark shadow-glass-dark transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold-light active:translate-y-0"
          >
            Đặt mua RIO Light Đào →
          </a>
        </Reveal>

        {/* giữa: lon 3D */}
        <Reveal delay={0.1} className="lg:col-span-4">
          <div className="relative mx-auto h-[380px] w-full max-w-[280px] sm:h-[480px] sm:max-w-xs lg:h-[560px]">
            <Product3D
              image="/products-light/riolight-dao-brandy.jpg"
              glow="#FFA3BC"
              label="Lon RIO Light Đào & Brandy"
              bubbles={34}
              className="absolute inset-0"
            />
          </div>
          <p className="mt-3 text-center text-[12px] font-medium text-cream/45">
            Kéo để xoay 360°
          </p>
        </Reveal>

        {/* phải: 3 thẻ tính năng */}
        <Reveal delay={0.2} className="lg:col-span-3">
          <h3 className="font-display text-xl font-bold leading-tight text-cream">
            Nguyên liệu sạch.
            <br />
            Trọn vị thật.
          </h3>
          <div className="mt-5 flex flex-col gap-3.5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-4 rounded-[20px] border border-white/10 bg-white/[0.04] p-[18px] backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 text-gold">
                  <f.icon size={18} />
                </div>
                <div className="flex-1">
                  <h4 className="text-[15px] font-semibold leading-tight text-cream">{f.title}</h4>
                  <p className="mt-1 text-[13px] leading-snug text-cream/60">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
