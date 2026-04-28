import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import {
  listTableProofreadingHitValidationChecks,
  listTableProofreadingKnowledgeTemplates,
} from "./template-governance-table-proofreading-guidance.ts";
import {
  formatTemplateGovernanceEvidenceLevelLabel,
  formatTemplateGovernanceKnowledgeKindLabel,
  formatTemplateGovernanceKnowledgeSourceTypeLabel,
} from "./template-governance-display.ts";

export interface TemplateGovernanceProofreadingStrategyPaneProps {
  proofreadingRuleSetCount: number;
  proofreadingTemplateCount: number;
  proofreadingInstructionCount: number;
  tableRuleCount: number;
  tableKnowledgeCount: number;
}

export function TemplateGovernanceProofreadingStrategyPane({
  proofreadingRuleSetCount,
  proofreadingTemplateCount,
  proofreadingInstructionCount,
  tableRuleCount,
  tableKnowledgeCount,
}: TemplateGovernanceProofreadingStrategyPaneProps) {
  const tableKnowledgeTemplates = listTableProofreadingKnowledgeTemplates();
  const tableHitValidationChecks = listTableProofreadingHitValidationChecks();

  return (
    <article className="template-governance-panel template-governance-panel-wide">
      <div className="template-governance-panel-header">
        <div>
          <h3>校对策略</h3>
        </div>
      </div>

      <div className="template-governance-strategy-grid">
        <article className="template-governance-card">
          <strong>规则创建</strong>
          <small>当前校对规则集：{proofreadingRuleSetCount}</small>
        </article>

        <article className="template-governance-card">
          <strong>模板套用</strong>
          <small>当前校对模板：{proofreadingTemplateCount}</small>
        </article>

        <article className="template-governance-card">
          <strong>通用校对</strong>
        </article>

        <article className="template-governance-card">
          <strong>医学专业校对</strong>
          <small>当前医学校对指令：{proofreadingInstructionCount}</small>
        </article>

        <article className="template-governance-card">
          <strong>表格校对专项</strong>
          <div className="template-governance-chip-row">
            <span className="template-governance-chip">表题置于表上</span>
            <span className="template-governance-chip">表注置于表下</span>
            <span className="template-governance-chip">三线表与禁用竖线</span>
            <span className="template-governance-chip">单位与统计注释一致</span>
          </div>
          <small>
            表格规则 {tableRuleCount} 条 / 表格知识 {tableKnowledgeCount} 条
          </small>
        </article>

        <article
          className="template-governance-card"
          data-table-proofreading-knowledge-templates="field"
        >
          <strong>表格专项知识模板</strong>
          <div className="template-governance-proofreading-guidance-grid">
            {tableKnowledgeTemplates.map((template) => (
              <div
                key={template.id}
                className="template-governance-proofreading-guidance-card"
              >
                <strong>{template.title}</strong>
                <div className="template-governance-chip-row">
                  <span className="template-governance-chip">
                    {formatTemplateGovernanceKnowledgeKindLabel(template.knowledgeKind)}
                  </span>
                  <span className="template-governance-chip">
                    {formatTemplateGovernanceKnowledgeSourceTypeLabel(template.sourceType)}
                  </span>
                  <span className="template-governance-chip">
                    {formatTemplateGovernanceEvidenceLevelLabel(template.evidenceLevel)}
                  </span>
                </div>
                <div className="template-governance-actions">
                  <a
                    className="template-governance-link-button"
                    href={formatWorkbenchHash("knowledge-library", {
                      knowledgeView: "ledger",
                      knowledgePrefillTemplateId: template.id,
                    })}
                    data-prefill-knowledge-template={template.id}
                  >
                    {"\u9884\u586b\u5230\u77e5\u8bc6\u5e93"}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article
          className="template-governance-card"
          data-table-proofreading-hit-validation="field"
        >
          <strong>命中验证关注点</strong>
          <div className="template-governance-proofreading-guidance-grid">
            {tableHitValidationChecks.map((check) => (
              <div
                key={check.id}
                className="template-governance-proofreading-guidance-card"
              >
                <strong>{check.title}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="template-governance-card">
          <strong>人工复核触发</strong>
        </article>
      </div>
    </article>
  );
}
