import type { FormEvent } from "react";
import type { EditorialRuleSetViewModel } from "../editorial-rules/index.ts";
import type { KnowledgeItemViewModel } from "../knowledge/index.ts";
import {
  SearchableMultiSelectField,
  type SearchableMultiSelectOption,
} from "../../lib/searchable-multi-select.tsx";
import {
  listRuleAuthoringPresets,
} from "./rule-authoring-presets.ts";
import {
  RuleAuthoringTableSemanticFields,
} from "./rule-authoring-table-semantic-fields.tsx";
import {
  formatTemplateGovernanceConfidencePolicyLabel,
  formatTemplateGovernanceExecutionModeLabel,
  formatTemplateGovernanceGovernedAssetStatusLabel,
  formatTemplateGovernanceKnowledgeKindLabel,
  formatTemplateGovernanceModuleLabel,
  formatTemplateGovernanceSeverityLabel,
} from "./template-governance-display.ts";
import type {
  RuleAuthoringDraft,
} from "./rule-authoring-types.ts";

export interface RuleAuthoringFormProps {
  selectedRuleSet: EditorialRuleSetViewModel | null;
  draft: RuleAuthoringDraft;
  knowledgeItems?: readonly KnowledgeItemViewModel[];
  isBusy: boolean;
  onDraftChange(next: RuleAuthoringDraft): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void | Promise<void>;
}

export function RuleAuthoringForm({
  selectedRuleSet,
  draft,
  knowledgeItems = [],
  isBusy,
  onDraftChange,
  onSubmit,
}: RuleAuthoringFormProps) {
  const preset = listRuleAuthoringPresets().find(
    (candidate) => candidate.object === draft.ruleObject,
  );

  return (
    <article className="template-governance-card">
      <div className="template-governance-panel-header">
        <div>
          <h3>高级规则编辑器</h3>
          <p>
            用对象化表单录入规则，不再手写底层选择器 JSON。
          </p>
        </div>
      </div>

      {selectedRuleSet ? (
        <>
          <p className="template-governance-selected-note">
            当前正在编辑 {formatTemplateGovernanceModuleLabel(selectedRuleSet.module)} 规则集 v
            {selectedRuleSet.version_no}（
            {selectedRuleSet.journal_template_id ? "期刊加层" : "模板族基线"}）
          </p>
          <form className="template-governance-form-grid" onSubmit={onSubmit}>
            <label className="template-governance-field">
              <span>规则对象</span>
              <input value={preset?.objectLabel ?? draft.ruleObject} disabled />
            </label>
            <label className="template-governance-field">
              <span>顺序</span>
              <input
                value={String(draft.orderNo)}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    orderNo: Number.parseInt(event.target.value || "0", 10) || 0,
                  })
                }
              />
            </label>
            <label className="template-governance-field">
              <span>执行方式</span>
              <select
                value={draft.executionMode}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    executionMode: event.target.value as RuleAuthoringDraft["executionMode"],
                  })
                }
              >
                <option value="apply">
                  {formatTemplateGovernanceExecutionModeLabel("apply")}
                </option>
                <option value="inspect">
                  {formatTemplateGovernanceExecutionModeLabel("inspect")}
                </option>
                <option value="apply_and_inspect">
                  {formatTemplateGovernanceExecutionModeLabel("apply_and_inspect")}
                </option>
              </select>
            </label>
            <label className="template-governance-field">
              <span>置信策略</span>
              <select
                value={draft.confidencePolicy}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    confidencePolicy:
                      event.target.value as RuleAuthoringDraft["confidencePolicy"],
                  })
                }
              >
                <option value="always_auto">
                  {formatTemplateGovernanceConfidencePolicyLabel("always_auto")}
                </option>
                <option value="high_confidence_only">
                  {formatTemplateGovernanceConfidencePolicyLabel("high_confidence_only")}
                </option>
                <option value="manual_only">
                  {formatTemplateGovernanceConfidencePolicyLabel("manual_only")}
                </option>
              </select>
            </label>
            <label className="template-governance-field">
              <span>严重级别</span>
              <select
                value={draft.severity}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    severity: event.target.value as RuleAuthoringDraft["severity"],
                  })
                }
              >
                <option value="info">
                  {formatTemplateGovernanceSeverityLabel("info")}
                </option>
                <option value="warning">
                  {formatTemplateGovernanceSeverityLabel("warning")}
                </option>
                <option value="error">
                  {formatTemplateGovernanceSeverityLabel("error")}
                </option>
              </select>
            </label>
            <label className="template-governance-field">
              <span>证据级别</span>
              <select
                value={draft.evidenceLevel}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    evidenceLevel:
                      event.target.value as RuleAuthoringDraft["evidenceLevel"],
                  })
                }
              >
                <option value="unknown">未知</option>
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
                <option value="expert_opinion">专家意见</option>
              </select>
            </label>

            <RuleAuthoringParameterGuide />

            <RuleAuthoringLinkedKnowledgeField
              draft={draft}
              knowledgeItems={knowledgeItems}
              onDraftChange={onDraftChange}
            />

            <ObjectSpecificRuleFields draft={draft} onDraftChange={onDraftChange} />

            <div className="template-governance-actions template-governance-actions-full">
              <button type="submit" disabled={isBusy || selectedRuleSet.status !== "draft"}>
                {isBusy ? "保存中..." : "新建规则草稿"}
              </button>
            </div>
          </form>
        </>
      ) : (
        <p className="template-governance-empty">
          先创建或选择规则集，再录入对象化规则。
        </p>
      )}
    </article>
  );
}

function RuleAuthoringParameterGuide() {
  return (
    <section
      className="template-governance-card template-governance-field-full"
      data-rule-parameter-guide="field"
    >
      <strong>参数说明</strong>
      <p>规则中心负责可执行判断，知识条目只放证据、依据、范例或解释。</p>
      <div className="template-governance-chip-row">
        <span className="template-governance-chip">
          执行方式决定是自动改写还是只检查
        </span>
        <span className="template-governance-chip">
          置信策略决定何时允许自动执行
        </span>
        <span className="template-governance-chip">
          关联知识条目只挂支撑证据，不承载执行逻辑
        </span>
      </div>
    </section>
  );
}

function RuleAuthoringLinkedKnowledgeField({
  draft,
  knowledgeItems,
  onDraftChange,
}: {
  draft: RuleAuthoringDraft;
  knowledgeItems: readonly KnowledgeItemViewModel[];
  onDraftChange(next: RuleAuthoringDraft): void;
}) {
  const selectedIds = draft.linkedKnowledgeItemIds ?? [];
  const selectedItemIds = new Set(selectedIds);
  const knowledgeOptions: SearchableMultiSelectOption[] = knowledgeItems.map((item) => ({
    value: item.id,
    label: item.title,
    keywords: [item.knowledge_kind, item.status],
    meta: `${formatTemplateGovernanceKnowledgeKindLabel(item.knowledge_kind)} / ${formatTemplateGovernanceGovernedAssetStatusLabel(item.status)}`,
  }));

  const selectedItems: Array<{
    id: string;
    title: string;
    knowledge_kind: KnowledgeItemViewModel["knowledge_kind"];
    status: KnowledgeItemViewModel["status"];
  }> = selectedIds.map((id) => {
    const matched = knowledgeItems.find((item) => item.id === id);
    return matched ?? {
      id,
      title: id,
      knowledge_kind: "reference",
      status: "draft",
    };
  });

  return (
    <div
      className="template-governance-field template-governance-field-full template-governance-linked-knowledge"
      data-rule-linked-knowledge="field"
    >
      <SearchableMultiSelectField
        label={"\u5173\u8054\u77e5\u8bc6\u6761\u76ee"}
        helpText={
          "\u628a\u89c4\u5219\u4f9d\u8d56\u7684\u8bc1\u636e\u6216\u53c2\u8003\u6761\u76ee\u663e\u5f0f\u6302\u4e0a\uff0c\u907f\u514d\u89c4\u5219\u548c\u77e5\u8bc6\u6df7\u5728\u4e00\u4e2a\u5165\u53e3\u91cc\u3002"
        }
        value={selectedIds}
        options={knowledgeOptions}
        dataKey="rule-authoring-linked-knowledge"
        className="template-governance-linked-knowledge"
        headerClassName="template-governance-linked-knowledge-header"
        searchFieldClassName="knowledge-library-grid-search"
        searchPlaceholder={"\u641c\u7d22\u5173\u8054\u77e5\u8bc6\u6761\u76ee"}
        optionsClassName="template-governance-linked-knowledge-list"
        optionClassName="template-governance-linked-knowledge-option"
        emptyClassName="template-governance-inline-empty"
        showSelectedSummary
        selectedOptions={selectedItems.map((item) => ({
          value: item.id,
          label: item.title,
        }))}
        selectedListClassName="template-governance-chip-row"
        selectedChipClassName="template-governance-chip"
        selectedEmptyText={"\u5f53\u524d\u8fd8\u6ca1\u6709\u5173\u8054\u77e5\u8bc6\u6761\u76ee\u3002"}
        emptyOptionsText={"\u5f53\u524d\u6ca1\u6709\u53ef\u5173\u8054\u7684\u77e5\u8bc6\u6761\u76ee\u3002"}
        noResultsText={"\u672a\u627e\u5230\u5339\u914d\u7684\u77e5\u8bc6\u6761\u76ee\u3002"}
        onToggleValue={(nextKnowledgeId) => {
          const isActive = selectedItemIds.has(nextKnowledgeId);
          onDraftChange({
            ...draft,
            linkedKnowledgeItemIds: isActive
              ? selectedIds.filter((id) => id !== nextKnowledgeId)
              : [...selectedIds, nextKnowledgeId],
          });
        }}
      />
    </div>
  );
}

function ObjectSpecificRuleFields({
  draft,
  onDraftChange,
}: {
  draft: RuleAuthoringDraft;
  onDraftChange(next: RuleAuthoringDraft): void;
}) {
  switch (draft.ruleObject) {
    case "abstract":
      return (
        <>
          <label className="template-governance-field">
            <span>标签角色</span>
            <select
              value={draft.payload.labelRole}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  payload: {
                    ...draft.payload,
                    labelRole: event.target.value as typeof draft.payload.labelRole,
                  },
                })
              }
            >
              <option value="objective">目的</option>
              <option value="methods">方法</option>
              <option value="results">结果</option>
              <option value="conclusion">结论</option>
            </select>
          </label>
          <label className="template-governance-field">
            <span>原始标签文本</span>
            <input
              value={draft.payload.sourceLabelText}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  payload: {
                    ...draft.payload,
                    sourceLabelText: event.target.value,
                  },
                })
              }
            />
          </label>
          <label className="template-governance-field template-governance-field-full">
            <span>规范化标签文本</span>
            <input
              value={draft.payload.normalizedLabelText}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  payload: {
                    ...draft.payload,
                    normalizedLabelText: event.target.value,
                  },
                })
              }
            />
          </label>
        </>
      );
    case "heading_hierarchy":
      return (
        <>
          <TextField
            label="目标章节"
            value={draft.payload.targetSection}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  targetSection: value as typeof draft.payload.targetSection,
                },
              })
            }
          />
          <TextField
            label="预期顺序"
            value={draft.payload.expectedSequence}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  expectedSequence: value,
                },
              })
            }
          />
          <TextField
            label="标题模式"
            value={draft.payload.headingPattern}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  headingPattern: value,
                },
              })
            }
          />
        </>
      );
    case "numeric_unit":
      return (
        <>
          <TextField
            label="目标章节"
            value={draft.payload.targetSection}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  targetSection: value as typeof draft.payload.targetSection,
                },
              })
            }
          />
          <TextField
            label="单位标准"
            value={draft.payload.unitStandard}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  unitStandard: value,
                },
              })
            }
          />
          <TextField
            label="保留位数"
            value={draft.payload.decimalPlaces}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  decimalPlaces: value,
                },
              })
            }
          />
        </>
      );
    case "statistical_expression":
      return (
        <>
          <TextField
            label="目标章节"
            value={draft.payload.targetSection}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  targetSection: value as typeof draft.payload.targetSection,
                },
              })
            }
          />
          <TextField
            label="表达式模式"
            value={draft.payload.expressionPattern}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  expressionPattern: value,
                },
              })
            }
          />
          <TextField
            label="报告要求"
            value={draft.payload.reportingRequirement}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  reportingRequirement: value,
                },
              })
            }
          />
          <label className="template-governance-field">
            <span>指标家族</span>
            <select
              value={draft.payload.metricFamily}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  payload: {
                    ...draft.payload,
                    metricFamily:
                      event.target.value as typeof draft.payload.metricFamily,
                  },
                })
              }
            >
              <option value="basic">基础统计</option>
              <option value="diagnostic">诊断学统计</option>
              <option value="regression">回归统计</option>
              <option value="inferential">推断统计</option>
            </select>
          </label>
          <TextField
            label="支持指标"
            value={draft.payload.supportedMetrics}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  supportedMetrics: value,
                },
              })
            }
            fullWidth
          />
          <TextField
            label="配套证据"
            value={draft.payload.requiredCompanionEvidence}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  requiredCompanionEvidence: value,
                },
              })
            }
            fullWidth
          />
          <TextField
            label="重算策略"
            value={draft.payload.recalculationPolicy}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  recalculationPolicy: value,
                },
              })
            }
          />
        </>
      );
    case "table":
      return (
        <RuleAuthoringTableSemanticFields
          draft={draft}
          onDraftChange={onDraftChange}
        />
      );
    case "reference":
      return (
        <>
          <TextField
            label="引文格式"
            value={draft.payload.citationStyle}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  citationStyle: value,
                },
              })
            }
          />
          <TextField
            label="编号方案"
            value={draft.payload.numberingScheme}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  numberingScheme: value,
                },
              })
            }
          />
          <TextField
            label="DOI 要求"
            value={draft.payload.doiRequirement}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  doiRequirement: value,
                },
              })
            }
          />
        </>
      );
    case "declaration":
      return (
        <>
          <label className="template-governance-field">
            <span>声明类型</span>
            <select
              value={draft.payload.declarationKind}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  payload: {
                    ...draft.payload,
                    declarationKind:
                      event.target.value as typeof draft.payload.declarationKind,
                  },
                })
              }
            >
              <option value="ethics">伦理</option>
              <option value="trial_registration">试验注册</option>
              <option value="funding">基金</option>
              <option value="conflict_of_interest">利益冲突</option>
            </select>
          </label>
          <TextField
            label="必填声明"
            value={draft.payload.requiredStatement}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  requiredStatement: value,
                },
              })
            }
            fullWidth
          />
          <TextField
            label="出现位置"
            value={draft.payload.placement}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  placement: value,
                },
              })
            }
          />
        </>
      );
    case "statement":
      return (
        <>
          <label className="template-governance-field">
            <span>声明类型</span>
            <select
              value={draft.payload.statementKind}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  payload: {
                    ...draft.payload,
                    statementKind:
                      event.target.value as typeof draft.payload.statementKind,
                  },
                })
              }
            >
              <option value="ethics">伦理</option>
              <option value="trial_registration">试验注册</option>
              <option value="funding">基金</option>
              <option value="conflict_of_interest">利益冲突</option>
              <option value="author_contribution">作者贡献</option>
            </select>
          </label>
          <TextField
            label="必填声明"
            value={draft.payload.requiredStatement}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  requiredStatement: value,
                },
              })
            }
            fullWidth
          />
          <TextField
            label="出现位置"
            value={draft.payload.placement}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  placement: value,
                },
              })
            }
          />
        </>
      );
    case "title":
      return (
        <>
          <TextField
            label="题名模式"
            value={draft.payload.titlePattern}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  titlePattern: value,
                },
              })
            }
            fullWidth
          />
          <TextField
            label="大小写规则"
            value={draft.payload.casingRule}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  casingRule: value,
                },
              })
            }
          />
          <TextField
            label="副标题处理"
            value={draft.payload.subtitleHandling}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  subtitleHandling: value,
                },
              })
            }
          />
        </>
      );
    case "author_line":
      return (
        <>
          <TextField
            label="分隔符"
            value={draft.payload.separator}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  separator: value,
                },
              })
            }
          />
          <TextField
            label="单位格式"
            value={draft.payload.affiliationFormat}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  affiliationFormat: value,
                },
              })
            }
            fullWidth
          />
          <TextField
            label="通信作者规则"
            value={draft.payload.correspondingAuthorRule}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  correspondingAuthorRule: value,
                },
              })
            }
            fullWidth
          />
        </>
      );
    case "keyword":
      return (
        <>
          <TextField
            label="关键词数量"
            value={draft.payload.keywordCount}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  keywordCount: value,
                },
              })
            }
          />
          <TextField
            label="分隔符"
            value={draft.payload.separator}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  separator: value,
                },
              })
            }
          />
          <TextField
            label="词表要求"
            value={draft.payload.vocabularyRequirement}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  vocabularyRequirement: value,
                },
              })
            }
            fullWidth
          />
        </>
      );
    case "terminology":
      return (
        <>
          <label className="template-governance-field">
            <span>目标章节</span>
            <select
              value={draft.payload.targetSection}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  payload: {
                    ...draft.payload,
                    targetSection:
                      event.target.value as typeof draft.payload.targetSection,
                  },
                })
              }
            >
              <option value="title">题名</option>
              <option value="abstract">摘要</option>
              <option value="body">正文</option>
              <option value="global">全文</option>
            </select>
          </label>
          <TextField
            label="首选术语"
            value={draft.payload.preferredTerm}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  preferredTerm: value,
                },
              })
            }
          />
          <TextField
            label="禁用变体"
            value={draft.payload.disallowedVariant}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  disallowedVariant: value,
                },
              })
            }
          />
        </>
      );
    case "figure":
      return (
        <>
          <label className="template-governance-field">
            <span>图片类型</span>
            <select
              value={draft.payload.figureKind}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  payload: {
                    ...draft.payload,
                    figureKind: event.target.value as typeof draft.payload.figureKind,
                  },
                })
              }
            >
              <option value="flowchart">流程图</option>
              <option value="clinical_image">临床图片</option>
              <option value="trend_chart">趋势图</option>
              <option value="pathology_image">病理图片</option>
            </select>
          </label>
          <TextField
            label="图题要求"
            value={draft.payload.captionRequirement}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  captionRequirement: value,
                },
              })
            }
            fullWidth
          />
          <TextField
            label="文件要求"
            value={draft.payload.fileRequirement}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  fileRequirement: value,
                },
              })
            }
            fullWidth
          />
        </>
      );
    case "manuscript_structure":
      return (
        <>
          <TextField
            label="稿件类型"
            value={draft.payload.manuscriptType}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  manuscriptType: value,
                },
              })
            }
          />
          <TextField
            label="必须章节"
            value={draft.payload.requiredSections}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  requiredSections: value,
                },
              })
            }
            fullWidth
          />
          <TextField
            label="章节顺序"
            value={draft.payload.sectionOrder}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  sectionOrder: value,
                },
              })
            }
            fullWidth
          />
        </>
      );
    case "journal_column":
      return (
        <>
          <TextField
            label="栏目名称"
            value={draft.payload.columnName}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  columnName: value,
                },
              })
            }
          />
          <TextField
            label="栏目要求"
            value={draft.payload.requirement}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  requirement: value,
                },
              })
            }
            fullWidth
          />
          <TextField
            label="来源位置"
            value={draft.payload.sourceSection}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  sourceSection: value,
                },
              })
            }
          />
        </>
      );
  }
}

function TextField({
  label,
  value,
  onChange,
  fullWidth = false,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  fullWidth?: boolean;
}) {
  return (
    <label
      className={
        fullWidth
          ? "template-governance-field template-governance-field-full"
          : "template-governance-field"
      }
    >
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
