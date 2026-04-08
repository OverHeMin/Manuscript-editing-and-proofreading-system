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
        <span>Semantic Target</span>
        <select
          value={payload.semanticTarget}
          onChange={(event) =>
            updatePayload(draft, onDraftChange, {
              semanticTarget: event.target.value as typeof payload.semanticTarget,
            })
          }
        >
          <option value="header_cell">header_cell</option>
          <option value="stub_column">stub_column</option>
          <option value="data_cell">data_cell</option>
          <option value="footnote_item">footnote_item</option>
        </select>
      </label>

      <label className="template-governance-field">
        <span>Expected Table Shape</span>
        <select
          value={payload.tableKind}
          onChange={(event) =>
            updatePayload(draft, onDraftChange, {
              tableKind: event.target.value as typeof payload.tableKind,
            })
          }
        >
          <option value="three_line_table">three_line_table</option>
          <option value="general_data_table">general_data_table</option>
          <option value="baseline_characteristics_table">
            baseline_characteristics_table
          </option>
          <option value="outcome_indicator_table">outcome_indicator_table</option>
        </select>
      </label>

      {showHeaderPath ? (
        <TextField
          label="Header Path Includes"
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
          label="Row Key"
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
          label="Column Key"
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
          <span>Footnote Kind</span>
          <select
            value={payload.noteKind}
            onChange={(event) =>
              updatePayload(draft, onDraftChange, {
                noteKind: event.target.value as typeof payload.noteKind,
              })
            }
          >
            <option value="statistical_significance">statistical_significance</option>
            <option value="abbreviation">abbreviation</option>
            <option value="general">general</option>
          </select>
        </label>
      ) : null}

      {showUnitContext ? (
        <label className="template-governance-field">
          <span>Unit Context</span>
          <select
            value={payload.unitContext}
            onChange={(event) =>
              updatePayload(draft, onDraftChange, {
                unitContext: event.target.value as typeof payload.unitContext,
              })
            }
          >
            <option value="header">header</option>
            <option value="stub">stub</option>
            <option value="footnote">footnote</option>
          </select>
        </label>
      ) : null}

      <TextField
        label="Caption Requirement"
        value={payload.captionRequirement}
        onChange={(value) =>
          updatePayload(draft, onDraftChange, {
            captionRequirement: value,
          })
        }
      />

      <TextField
        label="Layout Requirement"
        value={payload.layoutRequirement}
        onChange={(value) =>
          updatePayload(draft, onDraftChange, {
            layoutRequirement: value,
          })
        }
      />

      <TextField
        label="Manual Review Reason"
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
