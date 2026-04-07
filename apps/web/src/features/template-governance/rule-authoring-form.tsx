import type { FormEvent } from "react";
import type { EditorialRuleSetViewModel } from "../editorial-rules/index.ts";
import {
  listRuleAuthoringPresets,
} from "./rule-authoring-presets.ts";
import type {
  RuleAuthoringDraft,
} from "./rule-authoring-types.ts";

export interface RuleAuthoringFormProps {
  selectedRuleSet: EditorialRuleSetViewModel | null;
  draft: RuleAuthoringDraft;
  isBusy: boolean;
  onDraftChange(next: RuleAuthoringDraft): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void | Promise<void>;
}

export function RuleAuthoringForm({
  selectedRuleSet,
  draft,
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
          <h3>Rule Authoring Form</h3>
          <p>
            Fill the object-specific form instead of hand-writing low-level selector JSON.
          </p>
        </div>
      </div>

      {selectedRuleSet ? (
        <>
          <p className="template-governance-selected-note">
            Editing {selectedRuleSet.module} rule set v{selectedRuleSet.version_no} (
            {selectedRuleSet.journal_template_id ? "journal override" : "base family"})
          </p>
          <form className="template-governance-form-grid" onSubmit={onSubmit}>
            <label className="template-governance-field">
              <span>Rule Object</span>
              <input value={preset?.objectLabel ?? draft.ruleObject} disabled />
            </label>
            <label className="template-governance-field">
              <span>Order</span>
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
              <span>Execution Mode</span>
              <select
                value={draft.executionMode}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    executionMode: event.target.value as RuleAuthoringDraft["executionMode"],
                  })
                }
              >
                <option value="apply">apply</option>
                <option value="inspect">inspect</option>
                <option value="apply_and_inspect">apply_and_inspect</option>
              </select>
            </label>
            <label className="template-governance-field">
              <span>Confidence Policy</span>
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
                <option value="always_auto">always_auto</option>
                <option value="high_confidence_only">high_confidence_only</option>
                <option value="manual_only">manual_only</option>
              </select>
            </label>
            <label className="template-governance-field">
              <span>Severity</span>
              <select
                value={draft.severity}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    severity: event.target.value as RuleAuthoringDraft["severity"],
                  })
                }
              >
                <option value="info">info</option>
                <option value="warning">warning</option>
                <option value="error">error</option>
              </select>
            </label>
            <label className="template-governance-field">
              <span>Evidence Level</span>
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
                <option value="unknown">unknown</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="expert_opinion">expert_opinion</option>
              </select>
            </label>

            <ObjectSpecificRuleFields draft={draft} onDraftChange={onDraftChange} />

            <div className="template-governance-actions template-governance-actions-full">
              <button type="submit" disabled={isBusy || selectedRuleSet.status !== "draft"}>
                {isBusy ? "Saving..." : "Create Rule Draft"}
              </button>
            </div>
          </form>
        </>
      ) : (
        <p className="template-governance-empty">
          Create or select a rule set before entering an object-specific rule.
        </p>
      )}
    </article>
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
            <span>Label Role</span>
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
              <option value="objective">objective</option>
              <option value="methods">methods</option>
              <option value="results">results</option>
              <option value="conclusion">conclusion</option>
            </select>
          </label>
          <label className="template-governance-field">
            <span>Source Label Text</span>
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
            <span>Normalized Label Text</span>
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
            label="Target Section"
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
            label="Expected Sequence"
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
            label="Heading Pattern"
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
            label="Target Section"
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
            label="Unit Standard"
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
            label="Decimal Places"
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
            label="Target Section"
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
            label="Expression Pattern"
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
            label="Reporting Requirement"
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
        </>
      );
    case "table":
      return (
        <>
          <label className="template-governance-field">
            <span>Table Kind</span>
            <select
              value={draft.payload.tableKind}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  payload: {
                    ...draft.payload,
                    tableKind: event.target.value as typeof draft.payload.tableKind,
                  },
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
          <TextField
            label="Caption Requirement"
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
          />
          <TextField
            label="Layout Requirement"
            value={draft.payload.layoutRequirement}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                payload: {
                  ...draft.payload,
                  layoutRequirement: value,
                },
              })
            }
          />
          <TextField
            label="Manual Review Reason"
            value={draft.payload.manualReviewReasonTemplate}
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
    case "reference":
      return (
        <>
          <TextField
            label="Citation Style"
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
            label="Numbering Scheme"
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
            label="DOI Requirement"
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
            <span>Declaration Kind</span>
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
              <option value="ethics">ethics</option>
              <option value="trial_registration">trial_registration</option>
              <option value="funding">funding</option>
              <option value="conflict_of_interest">conflict_of_interest</option>
            </select>
          </label>
          <TextField
            label="Required Statement"
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
            label="Placement"
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
