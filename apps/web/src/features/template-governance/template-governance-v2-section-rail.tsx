import type { TemplateGovernanceV2Section } from "./template-governance-v2-types.ts";

const sections: Array<{ id: TemplateGovernanceV2Section; label: string }> = [
  { id: "dashboard", label: "总览" },
  { id: "rules", label: "规则" },
  { id: "templates", label: "模板" },
  { id: "packages", label: "规则包" },
  { id: "extraction", label: "提取" },
  { id: "ai-intake", label: "AI 录入" },
  { id: "recovery", label: "回流" },
  { id: "release", label: "发布" },
  { id: "advanced", label: "高级" },
];

export interface TemplateGovernanceV2SectionRailProps {
  activeSection: TemplateGovernanceV2Section;
  counts: Partial<Record<TemplateGovernanceV2Section, number>>;
  onSectionChange: (section: TemplateGovernanceV2Section) => void;
}

export function TemplateGovernanceV2SectionRail({
  activeSection,
  counts,
  onSectionChange,
}: TemplateGovernanceV2SectionRailProps) {
  return (
    <nav className="rule-center-v2__rail" aria-label="规则中心分区">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          className={section.id === activeSection ? "is-active" : undefined}
          data-section={section.id}
          aria-current={section.id === activeSection ? "page" : undefined}
          onClick={() => onSectionChange(section.id)}
        >
          <span>{section.label}</span>
          {counts[section.id] ? <small>{counts[section.id]}</small> : null}
        </button>
      ))}
    </nav>
  );
}
