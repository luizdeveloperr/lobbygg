import { ServerCategory, CATEGORIES, CATEGORY_ICONS } from "@/lib/types";

interface CategoryFilterProps {
  selected: ServerCategory | null;
  onSelect: (category: ServerCategory | null) => void;
}

export function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
          selected === null
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-muted-foreground hover:text-foreground"
        }`}
      >
        Todos
      </button>
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat === selected ? null : cat)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all flex items-center gap-2 ${
            selected === cat
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="text-lg">{CATEGORY_ICONS[cat]}</span>
          {cat}
        </button>
      ))}
    </div>
  );
}
