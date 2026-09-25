import { Rotate3d } from "lucide-react";
import { Product3D } from "@/components/ui/Product3D";
import { stageBackground } from "@/lib/stage";

export function ProductCard({
  name,
  note,
  desc,
  image,
  glow,
  label,
}: {
  name: string;
  note: string;
  desc: string;
  image: string;
  glow: string;
  /** mô tả cho trình đọc màn hình, ví dụ "Chai RIO Dâu & Vodka" */
  label: string;
}) {
  return (
    <div className="group flex h-full min-w-0 max-w-full flex-col rounded-4xl bg-white shadow-glass transition-transform duration-300 hover:-translate-y-1.5 dark:bg-forest-light/40">
      {/* Sân khấu 3D: sản phẩm được tách nền, đứng trên sàn bóng và nhô lên khỏi mép khung */}
      <div className="relative h-[19rem] min-w-0">
        <div
          className="absolute inset-x-0 bottom-0 top-10 overflow-hidden rounded-t-4xl"
          style={{ background: stageBackground(glow) }}
        >
          <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            {note}
          </span>
          <span className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5 text-[11px] font-medium text-white/60">
            <Rotate3d size={13} aria-hidden /> Kéo để xoay 360°
          </span>
        </div>
        <Product3D image={image} glow={glow} label={label} className="absolute inset-0" />
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-base font-bold text-forest dark:text-cream">{name}</h3>
        <p className="mt-2 flex-1 text-[13px] leading-relaxed text-ink/70 dark:text-cream/65">{desc}</p>
        <a
          href="#lien-he"
          className="mt-4 inline-flex text-[13px] font-semibold text-leaf-dark hover:text-forest dark:text-gold dark:hover:text-cream"
        >
          Đặt mua →
        </a>
      </div>
    </div>
  );
}
