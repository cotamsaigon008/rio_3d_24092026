"use client";

import { useEffect, useRef, useState } from "react";
import { posterStyle, productAssets } from "@/lib/product3d-assets";
import type { RioSlot } from "@/lib/rio3d";

/**
 * Viewer 3D cho một sản phẩm (chai hoặc lon).
 *
 * Không tự tạo canvas/WebGL context riêng — chỉ đăng ký một "slot" với bộ render DÙNG CHUNG cho cả trang
 * (xem src/lib/rio3d.ts). Nhờ vậy sản phẩm luôn ở trạng thái 3D suốt vòng đời component: cuộn ra khỏi màn
 * hình chỉ tạm ngưng phần vẽ (tiết kiệm GPU) chứ không huỷ/tạo lại, nên không có khoảnh khắc "rơi về ảnh
 * tĩnh" khi cuộn qua lại — và không có giới hạn "tối đa bao nhiêu sản phẩm 3D cùng lúc" vì tất cả dùng
 * chung một WebGL context.
 *
 * Ảnh đã tách nền (poster, có alpha) hiển thị ngay khi component mount, rồi mờ dần đi khi khung hình 3D
 * đầu tiên vẽ xong — không có khung nền trắng, và cũng là bản dự phòng nếu trình duyệt không có WebGL.
 */
export function Product3D({
  image,
  glow,
  label,
  bubbles = 26,
  className = "",
}: {
  /** đường dẫn ảnh gốc, ví dụ /products/rio-dau-vodka.jpg */
  image: string;
  /** màu chủ đạo của vị (hex) */
  glow: string;
  label: string;
  bubbles?: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const assets = productAssets(image);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let gone = false;
    let slot: RioSlot | null = null;
    let dragging = false;

    const onMove = (ev: PointerEvent) => slot?.pointerMove(ev.clientX, ev.clientY);
    const onEnter = () => slot?.pointerEnter();
    const onLeave = () => {
      slot?.pointerLeave();
      if (dragging) {
        dragging = false;
        slot?.pointerUp();
      }
    };
    const onDown = (ev: PointerEvent) => {
      dragging = true;
      wrap.setPointerCapture?.(ev.pointerId);
      wrap.style.cursor = "grabbing";
      slot?.pointerDown(ev.clientX, ev.clientY);
    };
    const onUp = () => {
      dragging = false;
      wrap.style.cursor = "";
      slot?.pointerUp();
    };
    wrap.style.touchAction = "pan-y";
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerenter", onEnter);
    wrap.addEventListener("pointerleave", onLeave);
    wrap.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointercancel", onUp);

    (async () => {
      try {
        const { registerProductSlot } = await import("@/lib/rio3d");
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const s = await registerProductSlot({
          getRect: () => wrap.getBoundingClientRect(),
          layout: "card",
          products: [{ kind: assets.kind, tex: assets.tex, glow }],
          reduceMotion: reduce,
          bubbles,
          onFirstFrame: () => !gone && setReady(true),
        });
        if (gone) {
          s.dispose();
          return;
        }
        slot = s;
      } catch {
        // WebGL không khả dụng -> giữ nguyên poster đã tách nền
      }
    })();

    return () => {
      gone = true;
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerenter", onEnter);
      wrap.removeEventListener("pointerleave", onLeave);
      wrap.removeEventListener("pointerdown", onDown);
      wrap.removeEventListener("pointerup", onUp);
      wrap.removeEventListener("pointercancel", onUp);
      slot?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, glow, bubbles]);

  return (
    <div
      ref={wrapRef}
      className={`cursor-grab touch-pan-y select-none active:cursor-grabbing ${className}`}
      role="img"
      aria-label={label}
    >
      {/* Poster: ảnh đã tách nền (alpha) — hiển thị ngay, và là bản dự phòng khi không có WebGL.
          Canvas 3D thực tế là MỘT canvas dùng chung cho cả trang, vẽ đè lên đúng vị trí của khung này. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={assets.poster}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        style={posterStyle}
        className={`pointer-events-none absolute left-1/2 w-auto max-w-none -translate-x-1/2 select-none transition-opacity duration-500 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
      />
    </div>
  );
}
