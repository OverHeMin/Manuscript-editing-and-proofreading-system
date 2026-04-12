import type { TableRuleAuthoringDraft } from "./rule-authoring-types.ts";

export interface RuleAuthoringTableSemanticFieldsProps {
  draft: TableRuleAuthoringDraft;
  onDraftChange(next: TableRuleAuthoringDraft): void;
}

export function RuleAuthoringTableSemanticFields({
  draft,
  onDraftChange,
}: RuleAuthoringTableSemanticFieldsProps) {
  const { payload } = draft;
  const showHeaderPath = payload.semanticTarget === "header_cell";
  const showRowKey =
    payload.semanticTarget === "stub_column" ||
    payload.semanticTarget === "data_cell";
  const showColumnKey =
    payload.semanticTarget === "header_cell" ||
    payload.semanticTarget === "data_cell";
  const showNoteKind = payload.semanticTarget === "footnote_item";
  const showUnitContext = payload.semanticTarget === "data_cell";

  return (
    <>
      <label className="template-governance-field">
        <span>语义目标</span>
        <select
          value={payload.semanticTarget}
          onChange={(event) =>
            updatePayload(draft, onDraftChange, {
              semanticTarget: event.target.value as typeof payload.semanticTarget,
            })
          }
        >
          <option value="header_cell">表头单元</option>
          <option value="stub_column">桩列</option>
          <option value="data_cell">数据单元</option>
          <option value="footnote_item">脚注项</option>
        </select>
      </label>

      <label className="template-governance-field">
        <span>预期表格形态</span>
        <select
          value={payload.tableKind}
          onChange={(event) =>
            updatePayload(draft, onDraftChange, {
              tableKind: event.target.value as typeof payload.tableKind,
            })
          }
        >
          <option value="three_line_table">三线表</option>
          <option value="general_data_table">通用数据表</option>
          <option value="baseline_characteristics_table">
            基线特征表
          </option>
          <option value="outcome_indicator_table">结局指标表</option>
        </select>
      </label>

      {showHeaderPath ? (
        <TextField
          label="表头路径"
          value={payload.headerPathIncludes.join(" > ")}
          onChange={(value) =>
            updatePayload(draft, onDraftChange, {
              headerPathIncludes: parseSemanticPathInput(value),
            })
          }
          fullWidth
        />
      ) : null}

      {showRowKey ? (
        <TextField
          label="行标识"
          value={payload.rowKey}
          onChange={(value) =>
            updatePayload(draft, onDraftChange, {
              rowKey: value,
            })
          }
        />
      ) : null}

      {showColumnKey ? (
        <TextField
          label="列标识"
          value={payload.columnKey}
          onChange={(value) =>
            updatePayload(draft, onDraftChange, {
              columnKey: value,
            })
          }
          fullWidth={payload.semanticTarget === "header_cell"}
        />
      ) : null}

      {showNoteKind ? (
        <label className="template-governance-field">
          <span>脚注类型</span>
          <select
            value={payload.noteKind}
            onChange={(event) =>
              updatePayload(draft, onDraftChange, {
                noteKind: event.target.value as typeof payload.noteKind,
              })
            }
          >
            <option value="statistical_significance">统计学显著性</option>
            <option value="abbreviation">缩略语说明</option>
            <option value="general">一般说明</option>
          </select>
        </label>
      ) : null}

      {showUnitContext ? (
        <label className="template-governance-field">
          <span>单位上下文</span>
          <select
            value={payload.unitContext}
            onChange={(event) =>
              updatePayload(draft, onDraftChange, {
                unitContext: event.target.value as typeof payload.unitContext,
              })
            }
          >
            <option value="header">表头</option>
            <option value="stub">桩列</option>
            <option value="footnote">脚注</option>
          </select>
        </label>
      ) : null}

      <TextField
        label="表题要求"
        value={payload.captionRequirement}
        onChange={(value) =>
          updatePayload(draft, onDraftChange, {
            captionRequirement: value,
          })
        }
      />

      <TextField
        label="版式要求"
        value={payload.layoutRequirement}
        onChange={(value) =>
          updatePayload(draft, onDraftChange, {
            layoutRequirement: value,
          })
        }
      />

      <TextField
        label="人工复核原因"
        value={payload.manualReviewReasonTemplate}
        onChange={(value) =>
          onDraftChange({
            ...draft,
            manualReviewReasonTemplate: value,
            payload: {
              ...draft.payload,
              manualReviewReasonTemplate: value,
            },
          })
        }
        fullWidth
      />
    </>
  );
}

function updatePayload(
  draft: TableRuleAuthoringDraft,
  onDraftChange: (next: TableRuleAuthoringDraft) => void,
  payloadPatch: Partial<TableRuleAuthoringDraft["payload"]>,
) {
  onDraftChange({
    ...draft,
    payload: {
      ...draft.payload,
      ...payloadPatch,
    },
  });
}

function parseSemanticPathInput(value: string): string[] {
  return value
    .split(/>|,/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
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
