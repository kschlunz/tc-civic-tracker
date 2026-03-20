import Link from "next/link";
import { CATEGORIES, CATEGORY_ICONS } from "@/lib/constants";

export default function CategoryTag({ id }: { id: string }) {
  const category = CATEGORIES.find((c) => c.id === id);
  if (!category) return null;

  const materialIcon = CATEGORY_ICONS[id];

  return (
    <Link
      href={`/topics/${id}`}
      className="inline-flex items-center gap-1 rounded-full px-3 py-1 bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold uppercase tracking-tight hover:opacity-80 transition-opacity"
    >
      {materialIcon && (
        <span className="material-symbols-outlined text-[14px]">{materialIcon}</span>
      )}
      <span>{category.label}</span>
    </Link>
  );
}
