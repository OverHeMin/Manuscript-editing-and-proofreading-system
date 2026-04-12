export interface TemplateGovernanceProofreadingStrategyPaneProps {
  proofreadingRuleSetCount: number;
  proofreadingTemplateCount: number;
  proofreadingInstructionCount: number;
}

export function TemplateGovernanceProofreadingStrategyPane({
  proofreadingRuleSetCount,
  proofreadingTemplateCount,
  proofreadingInstructionCount,
}: TemplateGovernanceProofreadingStrategyPaneProps) {
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
      </div>
    </article>
  );
}
