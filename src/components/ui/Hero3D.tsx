"use client";

import { useEffect, useRef, useState } from "react";
import { posterStyle, productAssets } from "@/lib/product3d-assets";
import type { ProductSpec, RioSlot } from "@/lib/rio3d";

/** Cụm sản phẩm ở hero: 3 chai + 2 lon RIO Light, dựng trong một slot 3D duy nhất. */
const HERO_ITEMS: { image: string; glow: string; spec: Partial<ProductSpec> }[] = [
  // phía sau
  {
    image: "/products/rio-vietquat-vodka.jpg",
    glow: "#8B7CF0",
    spec: { pos: [-0.56, 0, -0.62], scale: 0.94, roll: 0.06, yaw0: 0.42, delay: 0.32 },
  },
  {
    image: "/products/rio-chanh-dualeo-rum.jpg",
    glow: "#7ED957",
    spec: { pos: [0.6, 0, -0.55], scale: 0.94, roll: -0.06, yaw0: -0.42, delay: 0.42 },
  },
  // trung tâm
  {
    image: "/products/rio-dau-vodka.jpg",
    glow: "#FF5A6E",
    spec: { pos: [0, 0, 0.08], scale: 1.1, yaw0: 0.0, delay: 0.0 },
  },
  // phía trước (lon RIO Light, nhỏ hơn chai)
  {
    image: "/products-light/riolight-dao-brandy.jpg",
    glow: "#FFA3BC",
    spec: { pos: [-0.4, 0, 0.62], scale: 0.62, roll: 0.04, yaw0: 0.55, delay: 0.62 },
  },
  {
    image: "/products-light/riolight-chanhday-vodka.jpg",
    glow: "#FFCF3F",
    spec: { pos: [0.42, 0, 0.58], scale: 0.62, roll: -0.04, yaw0: -0.55, delay: 0.74 },
  },
];

/**
 * Cụm 3D ở đầu trang — cũng chỉ đăng ký một "slot" với bộ render dùng chung cho cả trang (không tự tạo
 * canvas/context riêng), nên luôn ở trạng thái 3D liên tục, không tranh chấp tài nguyên với các card sản
 * phẩm bên dưới và không bao giờ phải rơi về ảnh tĩnh.
 */
export function Hero3D({ className = "" }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let slot: RioSlot | null = null;
    let gone = false;
    let raf = 0;

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = wrap.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
        slot?.setScroll(p);
      });
    };
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerType === "touch") return;
      slot?.pointerMove(ev.clientX, ev.clientY);
    };
    const onDown = (ev: PointerEvent) => slot?.pointerDown(ev.clientX, ev.clientY);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    wrap.addEventListener("pointerdown", onDown);

    (async () => {
      try {
        const { registerProductSlot } = await import("@/lib/rio3d");
        const products: ProductSpec[] = HERO_ITEMS.map((it) => {
          const a = productAssets(it.image);
          return { kind: a.kind, tex: a.tex, glow: it.glow, ...it.spec };
        });
        const s = await registerProductSlot({
          getRect: () => wrap.getBoundingClientRect(),
          layout: "hero",
          products,
          reduceMotion: reduce,
          bubbles: 70,
          onFirstFrame: () => !gone && setReady(true),
        });
        if (gone) {
          s.dispose();
          return;
        }
        slot = s;
      } catch (err) {
        console.error("Hero3D slot error:", err);
        if (!gone) setFailed(true);
      }
    })();

    return () => {
      gone = true;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerdown", onDown);
      if (raf) cancelAnimationFrame(raf);
      slot?.dispose();
    };
  }, []);

  const hero = productAssets("/products/rio-dau-vodka.jpg");

  return (
    <div
      ref={wrapRef}
      className={className}
      role="img"
      aria-label="Chai và lon RIO: Dâu & Vodka, Việt Quất, Chanh Dưa Leo, RIO Light Đào, RIO Light Chanh Dây"
    >
      {/* Poster: ảnh chai đã tách nền — hiển thị ngay khi trang tải, mờ dần khi 3D sẵn sàng; cũng là bản
          dự phòng khi trình duyệt không hỗ trợ WebGL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hero.poster}
        alt=""
        style={posterStyle}
        className={`pointer-events-none absolute left-1/2 w-auto max-w-none -translate-x-1/2 transition-opacity duration-700 ${
          ready && !failed ? "opacity-0" : "opacity-100"
        }`}
      />
    </div>
  );
}
