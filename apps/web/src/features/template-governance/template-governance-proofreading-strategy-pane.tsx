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
          <p>
            把规则创建、模板套用与校对策略拆开呈现，让一线人员先看懂用途，再按需进入更细的配置。
          </p>
        </div>
      </div>

      <div className="template-governance-strategy-grid">
        <article className="template-governance-card">
          <strong>规则创建</strong>
          <p>
            把高频、稳定、可解释的校对动作沉淀成规则集，方便 AI 与人工协同复用。
          </p>
          <small>当前校对规则集：{proofreadingRuleSetCount}</small>
        </article>

        <article className="template-governance-card">
          <strong>模板套用</strong>
          <p>
            用模板承载常见流程与检查清单，但不把产品表达成“只是在套模板”。
          </p>
          <small>当前校对模板：{proofreadingTemplateCount}</small>
        </article>

        <article className="template-governance-card">
          <strong>通用校对</strong>
          <p>
            负责格式一致性、标点编号、图表引用、版式收口等跨学科通用问题。
          </p>
          <small>建议与 AI 指令模板联动，覆盖多数基础稿件。</small>
        </article>

        <article className="template-governance-card">
          <strong>医学专业校对</strong>
          <p>
            聚焦医学术语、统计表达、试验设计、单位书写和高风险语义复核。
          </p>
          <small>当前医学校对指令：{proofreadingInstructionCount}</small>
        </article>

        <article className="template-governance-card">
          <strong>表格校对专项</strong>
          <p>
            把表题位置、表注位置、单位与统计注释、三线表与禁用竖线这些高频检查动作沉淀到规则中心，
            再把期刊样式依据、统计释义和异常示例沉淀到知识库。
          </p>
          <div className="template-governance-chip-row">
            <span className="template-governance-chip">表题置于表上</span>
            <span className="template-governance-chip">表注置于表下</span>
            <span className="template-governance-chip">三线表与禁用竖线</span>
            <span className="template-governance-chip">单位与统计注释一致</span>
          </div>
          <small>
            规则中心存检查动作，知识库存依据与示例。当前已覆盖 {tableRuleCount} 条表格规则与{" "}
            {tableKnowledgeCount} 条表格知识。
          </small>
        </article>

        <article
          className="template-governance-card"
          data-table-proofreading-knowledge-templates="field"
        >
          <strong>表格专项知识模板</strong>
          <p>
            把期刊样式依据、统计注释解释、单位报告规则和异常示例沉淀到知识库，再由规则中心显式关联。
          </p>
          <div className="template-governance-proofreading-guidance-grid">
            {tableKnowledgeTemplates.map((template) => (
              <div
                key={template.id}
                className="template-governance-proofreading-guidance-card"
              >
                <strong>{template.title}</strong>
                <p>{template.summary}</p>
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
          <p>
            先验证知识召回，再验证规则命中和人工复核闸口，避免只看格式结果却漏掉医学含义风险。
          </p>
          <div className="template-governance-proofreading-guidance-grid">
            {tableHitValidationChecks.map((check) => (
              <div
                key={check.id}
                className="template-governance-proofreading-guidance-card"
              >
                <strong>{check.title}</strong>
                <p>{check.description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="template-governance-card">
          <strong>人工复核触发</strong>
          <p>
            遇到表格重排、列表头改写、单位冲突、统计注释缺失或图片截图无法溯源时，不直接自动放行。
          </p>
          <small>建议把高风险命中留给人工终审，避免格式正确但医学含义失真。</small>
        </article>
      </div>
    </article>
  );
}
