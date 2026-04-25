import type { Dispatch, SetStateAction } from "react";
import type {
  JournalFormatTargetAnchor,
  JournalFormatTargetBlockViewModel,
  JournalFormatTargetCompletionGate,
  JournalFormatTargetContentSourcePolicy,
  JournalFormatTargetModelViewModel,
  JournalFormatTargetZone,
} from "../templates/index.ts";

export interface TemplateGovernanceJournalTemplateFormValues {
  templateFamilyId: string;
  journalName: string;
  journalKey: string;
  targetModel: JournalFormatTargetModelViewModel;
  targetModelVersionId?: string;
  targetModelVersionNo?: number;
}

export interface TemplateGovernanceJournalTemplateFormProps {
  mode?: "create" | "edit";
  initialValues?: Partial<TemplateGovernanceJournalTemplateFormValues>;
  isBusy?: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  onChange?: Dispatch<SetStateAction<TemplateGovernanceJournalTemplateFormValues>>;
  onCancel?: () => void;
  onSubmit?: () => void;
}

const defaultFormValues: TemplateGovernanceJournalTemplateFormValues = {
  templateFamilyId: "",
  journalName: "",
  journalKey: "",
  targetModel: createEmptyJournalFormatTargetModel(),
};

const journalFormatTargetZones: JournalFormatTargetZone[] = [
  "front_matter",
  "title",
  "abstract",
  "keywords",
  "body",
  "figures_tables",
  "references",
];
const journalFormatTargetAnchors: JournalFormatTargetAnchor[] = [
  "before_title",
  "after_title",
  "after_author_line",
  "after_affiliation_line",
  "after_abstract",
  "after_keywords",
  "before_body",
  "after_body",
  "before_reference",
  "header_zone",
  "footer_zone",
];
const journalFormatTargetContentSourcePolicies: JournalFormatTargetContentSourcePolicy[] = [
  "must_harvest_existing",
  "prefer_existing_with_manual_fill",
  "manual_only",
];
const journalFormatTargetCompletionGates: JournalFormatTargetCompletionGate[] = [
  "block_on_missing",
  "block_on_unresolved",
  "warn_only",
];

export function TemplateGovernanceJournalTemplateForm({
  mode = "create",
  initialValues,
  isBusy = false,
  statusMessage = null,
  errorMessage = null,
  onChange,
  onCancel,
  onSubmit,
}: TemplateGovernanceJournalTemplateFormProps) {
  const values = {
    ...defaultFormValues,
    ...initialValues,
  };
  const submitLabel =
    mode === "edit" ? "保存期刊模板修改" : "保存期刊模板草稿";

  return (
    <section className="template-governance-form-layer">
      <article className="template-governance-card template-governance-template-form">
        <header className="template-governance-form-header">
          <h2>{mode === "edit" ? "编辑期刊模板" : "新建期刊模板"}</h2>
          <p>期刊模板继承大模板能力，只补充期刊或场景级差异。</p>
        </header>
        {statusMessage ? <p className="template-governance-status">{statusMessage}</p> : null}
        {errorMessage ? <p className="template-governance-error">{errorMessage}</p> : null}
        <div className="template-governance-form-grid">
          <label className="template-governance-field">
            <span>所属大模板</span>
            <input
              value={values.templateFamilyId}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  templateFamilyId: event.target.value,
                }))
              }
            />
          </label>
          <label className="template-governance-field">
            <span>期刊名称</span>
            <input
              value={values.journalName}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  journalName: event.target.value,
                }))
              }
            />
          </label>
          <label className="template-governance-field">
            <span>期刊键</span>
            <input
              value={values.journalKey}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  journalKey: event.target.value,
                }))
              }
            />
          </label>
        </div>
        {mode === "edit" ? (
          <div className="template-governance-ledger-section">
            <header className="template-governance-ledger-section-header">
              <h3>格式目标模型</h3>
              <p>
                当前版本
                {values.targetModelVersionNo != null
                  ? ` V${values.targetModelVersionNo}`
                  : " 未发布"}
                ，固定骨架保持不变，目标块可编辑、增删、启停与排序。
              </p>
            </header>
            <div className="template-governance-actions">
              {values.targetModel.skeleton.map((zone) => (
                <span key={zone} className="template-governance-chip">
                  {zone}
                </span>
              ))}
            </div>
            <div className="template-governance-ledger-stack">
              {values.targetModel.target_blocks.map((block, index) => (
                <article key={`${block.block_key}-${index}`} className="template-governance-card">
                  <header className="template-governance-ledger-section-header">
                    <h4>{block.label || `目标块 ${index + 1}`}</h4>
                    <p>{block.block_key || "未命名 block key"}</p>
                  </header>
                  <div className="template-governance-form-grid">
                    <label className="template-governance-field">
                      <span>Block Key</span>
                      <input
                        value={block.block_key}
                        onChange={(event) =>
                          onChange?.((current) =>
                            updateTargetBlock(current, index, {
                              block_key: event.target.value,
                            }),
                          )
                        }
                      />
                    </label>
                    <label className="template-governance-field">
                      <span>显示名称</span>
                      <input
                        value={block.label}
                        onChange={(event) =>
                          onChange?.((current) =>
                            updateTargetBlock(current, index, {
                              label: event.target.value,
                            }),
                          )
                        }
                      />
                    </label>
                    <label className="template-governance-field">
                      <span>Zone</span>
                      <select
                        value={block.zone}
                        onChange={(event) =>
                          onChange?.((current) =>
                            updateTargetBlock(current, index, {
                              zone: event.target.value as JournalFormatTargetZone,
                            }),
                          )
                        }
                      >
                        {journalFormatTargetZones.map((zone) => (
                          <option key={zone} value={zone}>
                            {zone}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="template-governance-field">
                      <span>Anchor</span>
                      <select
                        value={block.anchor}
                        onChange={(event) =>
                          onChange?.((current) =>
                            updateTargetBlock(current, index, {
                              anchor: event.target.value as JournalFormatTargetAnchor,
                            }),
                          )
                        }
                      >
                        {journalFormatTargetAnchors.map((anchor) => (
                          <option key={anchor} value={anchor}>
                            {anchor}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="template-governance-field">
                      <span>排序</span>
                      <input
                        type="number"
                        value={block.order}
                        onChange={(event) =>
                          onChange?.((current) =>
                            updateTargetBlock(current, index, {
                              order: Number(event.target.value) || 0,
                            }),
                          )
                        }
                      />
                    </label>
                    <label className="template-governance-field">
                      <span>内容来源</span>
                      <select
                        value={block.content_source_policy}
                        onChange={(event) =>
                          onChange?.((current) =>
                            updateTargetBlock(current, index, {
                              content_source_policy:
                                event.target.value as JournalFormatTargetContentSourcePolicy,
                            }),
                          )
                        }
                      >
                        {journalFormatTargetContentSourcePolicies.map((policy) => (
                          <option key={policy} value={policy}>
                            {policy}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="template-governance-field">
                      <span>完成门禁</span>
                      <select
                        value={block.completion_gate}
                        onChange={(event) =>
                          onChange?.((current) =>
                            updateTargetBlock(current, index, {
                              completion_gate:
                                event.target.value as JournalFormatTargetCompletionGate,
                            }),
                          )
                        }
                      >
                        {journalFormatTargetCompletionGates.map((gate) => (
                          <option key={gate} value={gate}>
                            {gate}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="template-governance-field">
                      <span>前缀</span>
                      <input
                        value={block.format_policy.prefix ?? ""}
                        onChange={(event) =>
                          onChange?.((current) =>
                            updateTargetBlock(current, index, {
                              format_policy: {
                                ...block.format_policy,
                                prefix: event.target.value,
                              },
                            }),
                          )
                        }
                      />
                    </label>
                    <label className="template-governance-field">
                      <span>后缀</span>
                      <input
                        value={block.format_policy.suffix ?? ""}
                        onChange={(event) =>
                          onChange?.((current) =>
                            updateTargetBlock(current, index, {
                              format_policy: {
                                ...block.format_policy,
                                suffix: event.target.value,
                              },
                            }),
                          )
                        }
                      />
                    </label>
                    <label className="template-governance-field">
                      <span>分隔符</span>
                      <input
                        value={block.format_policy.separator ?? ""}
                        onChange={(event) =>
                          onChange?.((current) =>
                            updateTargetBlock(current, index, {
                              format_policy: {
                                ...block.format_policy,
                                separator: event.target.value,
                              },
                            }),
                          )
                        }
                      />
                    </label>
                    <label className="template-governance-field">
                      <span>目标位置说明</span>
                      <input
                        value={block.format_policy.target_position ?? ""}
                        onChange={(event) =>
                          onChange?.((current) =>
                            updateTargetBlock(current, index, {
                              format_policy: {
                                ...block.format_policy,
                                target_position: event.target.value,
                              },
                            }),
                          )
                        }
                      />
                    </label>
                    <label className="template-governance-field">
                      <span>样式要求</span>
                      <input
                        value={(block.format_policy.style_requirements ?? []).join(", ")}
                        onChange={(event) =>
                          onChange?.((current) =>
                            updateTargetBlock(current, index, {
                              format_policy: {
                                ...block.format_policy,
                                style_requirements: parseStyleRequirements(
                                  event.target.value,
                                ),
                              },
                            }),
                          )
                        }
                      />
                    </label>
                    <label className="template-governance-field">
                      <span>显示标签</span>
                      <input
                        value={block.format_policy.display_label ?? ""}
                        onChange={(event) =>
                          onChange?.((current) =>
                            updateTargetBlock(current, index, {
                              format_policy: {
                                ...block.format_policy,
                                display_label: event.target.value,
                              },
                            }),
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="template-governance-actions">
                    <label>
                      <input
                        type="checkbox"
                        checked={block.required}
                        onChange={(event) =>
                          onChange?.((current) =>
                            updateTargetBlock(current, index, {
                              required: event.target.checked,
                            }),
                          )
                        }
                      />
                      必填
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={block.repeatable}
                        onChange={(event) =>
                          onChange?.((current) =>
                            updateTargetBlock(current, index, {
                              repeatable: event.target.checked,
                            }),
                          )
                        }
                      />
                      可重复
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={block.enabled}
                        onChange={(event) =>
                          onChange?.((current) =>
                            updateTargetBlock(current, index, {
                              enabled: event.target.checked,
                            }),
                          )
                        }
                      />
                      启用
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={block.format_policy.allow_auto_reorder}
                        onChange={(event) =>
                          onChange?.((current) =>
                            updateTargetBlock(current, index, {
                              format_policy: {
                                ...block.format_policy,
                                allow_auto_reorder: event.target.checked,
                              },
                            }),
                          )
                        }
                      />
                      允许自动重排
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        onChange?.((current) => moveTargetBlock(current, index, -1))
                      }
                    >
                      上移
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onChange?.((current) => moveTargetBlock(current, index, 1))
                      }
                    >
                      下移
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onChange?.((current) => removeTargetBlock(current, index))
                      }
                    >
                      删除
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="template-governance-actions">
              <button
                type="button"
                onClick={() => onChange?.((current) => addTargetBlock(current))}
              >
                新增目标块
              </button>
            </div>
          </div>
        ) : (
          <p>创建后可在期刊模板详情中继续维护格式目标模型。</p>
        )}
        <div className="template-governance-actions">
          <button type="button" onClick={onCancel}>
            取消
          </button>
          <button type="button" onClick={onSubmit} disabled={isBusy}>
            {isBusy ? "保存中..." : submitLabel}
          </button>
        </div>
      </article>
    </section>
  );
}

function createEmptyJournalFormatTargetModel(): JournalFormatTargetModelViewModel {
  return {
    skeleton: [
      "front_matter",
      "title",
      "abstract",
      "keywords",
      "body",
      "figures_tables",
      "references",
    ],
    target_blocks: [],
  };
}

function parseStyleRequirements(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function updateTargetBlock(
  current: TemplateGovernanceJournalTemplateFormValues,
  index: number,
  nextBlock: Partial<JournalFormatTargetBlockViewModel>,
): TemplateGovernanceJournalTemplateFormValues {
  return {
    ...current,
    targetModel: {
      ...current.targetModel,
      target_blocks: current.targetModel.target_blocks.map((block, blockIndex) =>
        blockIndex === index ? { ...block, ...nextBlock } : block,
      ),
    },
  };
}

function moveTargetBlock(
  current: TemplateGovernanceJournalTemplateFormValues,
  index: number,
  delta: -1 | 1,
): TemplateGovernanceJournalTemplateFormValues {
  const nextIndex = index + delta;
  if (
    nextIndex < 0 ||
    nextIndex >= current.targetModel.target_blocks.length
  ) {
    return current;
  }

  const targetBlocks = [...current.targetModel.target_blocks];
  const [movedBlock] = targetBlocks.splice(index, 1);
  if (!movedBlock) {
    return current;
  }
  targetBlocks.splice(nextIndex, 0, movedBlock);

  return {
    ...current,
    targetModel: {
      ...current.targetModel,
      target_blocks: targetBlocks.map((block, blockIndex) => ({
        ...block,
        order: (blockIndex + 1) * 10,
      })),
    },
  };
}

function removeTargetBlock(
  current: TemplateGovernanceJournalTemplateFormValues,
  index: number,
): TemplateGovernanceJournalTemplateFormValues {
  return {
    ...current,
    targetModel: {
      ...current.targetModel,
      target_blocks: current.targetModel.target_blocks
        .filter((_, blockIndex) => blockIndex !== index)
        .map((block, blockIndex) => ({
          ...block,
          order: (blockIndex + 1) * 10,
        })),
    },
  };
}

function addTargetBlock(
  current: TemplateGovernanceJournalTemplateFormValues,
): TemplateGovernanceJournalTemplateFormValues {
  const nextIndex = current.targetModel.target_blocks.length + 1;
  return {
    ...current,
    targetModel: {
      ...current.targetModel,
      target_blocks: [
        ...current.targetModel.target_blocks,
        {
          block_key: `custom_block_${nextIndex}`,
          label: `新增目标块 ${nextIndex}`,
          zone: "front_matter",
          anchor: "before_title",
          order: nextIndex * 10,
          required: false,
          repeatable: false,
          enabled: true,
          format_policy: {
            allow_auto_reorder: true,
          },
          content_source_policy: "prefer_existing_with_manual_fill",
          completion_gate: "warn_only",
        },
      ],
    },
  };
}
