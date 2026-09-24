import { products } from "@/lib/content";
import { Reveal } from "@/components/ui/Reveal";
import { ProductCard } from "@/components/ui/ProductCard";

export function Products() {
  return (
    <section id="san-pham" className="relative bg-cream-soft py-24 dark:bg-forest/40 sm:py-32">
      <div className="container-rio">
        <Reveal className="max-w-xl">
          <span className="eyebrow">{products.eyebrow}</span>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight text-forest dark:text-cream sm:text-4xl">
            {products.title}
          </h2>
          <p className="mt-3 text-[13px] font-medium text-ink/55 dark:text-cream/55">{products.note}</p>
        </Reveal>

        {/* mt-20: chừa chỗ cho phần nắp chai nhô lên khỏi khung */}
        <div className="mt-20 grid gap-x-6 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
          {products.items.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.08}>
              <ProductCard
                name={p.name}
                note={p.note}
                desc={p.desc}
                image={p.image}
                glow={p.glow}
                label={`Chai ${p.name}`}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
