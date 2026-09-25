import { legal } from "@/lib/content";

export function LegalBar() {
  return (
    <div className="fixed inset-x-0 top-0 z-[70] flex h-7 min-w-0 items-center justify-center overflow-hidden bg-forest-dark px-4 text-center text-[10.5px] font-medium text-cream/85 sm:text-[11px]">
      <p className="w-full truncate">
        {legal.ageWarning} · {legal.drinkResponsibly}
      </p>
    </div>
  );
}
