import type { ReactNode } from "react";
import {
  TemplateGovernanceV2CommandBar,
  type TemplateGovernanceV2Command,
} from "./template-governance-v2-command-bar.tsx";
import { TemplateGovernanceV2SectionRail } from "./template-governance-v2-section-rail.tsx";
import type {
  TemplateGovernanceV2Panel,
  TemplateGovernanceV2Section,
} from "./template-governance-v2-types.ts";

export interface TemplateGovernanceV2ShellProps {
  activeSection: TemplateGovernanceV2Section;
  activePanel: TemplateGovernanceV2Panel;
  counts: Partial<Record<TemplateGovernanceV2Section, number>>;
  children: ReactNode;
  detailPanel?: ReactNode;
  onSectionChange: (section: TemplateGovernanceV2Section) => void;
  onCommand: (command: TemplateGovernanceV2Command) => void;
}

export function TemplateGovernanceV2Shell({
  activeSection,
  activePanel,
  counts,
  children,
  detailPanel,
  onSectionChange,
  onCommand,
}: TemplateGovernanceV2ShellProps) {
  const isImmersivePanel = activePanel === "rule-wizard";

  return (
    <section
      className={`rule-center-v2${isImmersivePanel ? " rule-center-v2--immersive" : ""}`}
      data-active-section={activeSection}
      data-active-panel={activePanel}
    >
      <header className="rule-center-v2__header">
        <p className="template-governance-eyebrow">规则中心</p>
        <h1>规则工作台</h1>
        <TemplateGovernanceV2CommandBar onCommand={onCommand} />
      </header>
      <div className="rule-center-v2__body">
        <TemplateGovernanceV2SectionRail
          activeSection={activeSection}
          counts={counts}
          onSectionChange={onSectionChange}
        />
        {isImmersivePanel ? null : (
          <main className="rule-center-v2__work-area">{children}</main>
        )}
        <aside
          className={`rule-center-v2__detail-panel${
            isImmersivePanel ? " rule-center-v2__detail-panel--immersive" : ""
          }`}
          data-panel={activePanel}
        >
          {detailPanel ?? <p className="template-governance-empty">未选择项目</p>}
        </aside>
      </div>
    </section>
  );
}
