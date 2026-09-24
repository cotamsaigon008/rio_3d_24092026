import { Sparkles } from "lucide-react";
import { productsLight } from "@/lib/content";
import { Reveal } from "@/components/ui/Reveal";
import { ProductCard } from "@/components/ui/ProductCard";

export function ProductsLight() {
  return (
    <section id="rio-light" className="relative py-24 sm:py-32">
      <div className="container-rio">
        <Reveal className="max-w-2xl">
          <span className="eyebrow">
            <Sparkles size={14} className="inline -mt-0.5 mr-1" />
            {productsLight.eyebrow}
          </span>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight text-forest dark:text-cream sm:text-4xl">
            {productsLight.title}
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-ink/70 dark:text-cream/70">{productsLight.intro}</p>
          <p className="mt-3 text-[13px] font-medium text-ink/55 dark:text-cream/55">{productsLight.note}</p>
        </Reveal>

        <div className="mt-20 grid gap-x-6 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
          {productsLight.items.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.08}>
              <ProductCard
                name={p.name}
                note={p.note}
                desc={p.desc}
                image={p.image}
                glow={p.glow}
                label={`Lon ${p.name}`}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
