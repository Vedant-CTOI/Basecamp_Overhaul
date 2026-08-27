"use client";

import { Category } from "@/lib/types";
import { PILLAR_LIST, BRAND, type PillarSlug } from "@/lib/config";
import { DoveTabs } from "@/components/DoveUI";

interface CategoryTabsProps {
  active: Category;
  onChange: (category: Category) => void;
  counts?: Record<string, number>;
  teamColor?: string;
  activeText?: string;
  inactiveText?: string;
  borderColor?: string;
  assignedPillars?: PillarSlug[]; // only show these pillars (3 of 4)
}

// Dove edition: the rail is now a floating pill rail (DoveUI language) —
// a sliding accent pill moves between tabs with a spring, counts pop
// when they change. The old underline style is retired. Callers pass
// the same props; dark surfaces pass teamColor=accent + activeText.
export default function CategoryTabs({
  active,
  onChange,
  counts,
  teamColor = "#002663",
  activeText = "#FFFFFF",
  inactiveText = "#8A8689",
  borderColor = "transparent",
  assignedPillars,
}: CategoryTabsProps) {
  const visiblePillars = assignedPillars
    ? PILLAR_LIST.filter((p) => assignedPillars.includes(p.slug))
    : PILLAR_LIST;

  return (
    <div className="py-2" style={{ borderBottom: `1px solid ${borderColor}` }}>
      <DoveTabs
        items={visiblePillars.map((p) => ({
          id: p.slug as Category,
          label: p.label,
          count: counts?.[p.slug],
        }))}
        active={active}
        onChange={(c) => onChange(c as Category)}
        accent={teamColor}
      />
    </div>
  );
}
