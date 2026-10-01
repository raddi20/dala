import { CATEGORY_GROUPS } from "@/lib/categories";

export function CategoryOptions({ blank }: { blank?: string }) {
  return (
    <>
      {blank ? <option value="">{blank}</option> : null}
      {CATEGORY_GROUPS.map((group) => (
        <optgroup key={group.id} label={group.title}>
          {group.categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
