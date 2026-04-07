import type { FormEvent } from "react";
import type { EditorialRuleSetViewModel } from "../editorial-rules/index.ts";
import type {
  TemplateGovernanceWorkbenchOverview,
} from "./template-governance-controller.ts";
import { listRuleAuthoringPresets } from "./rule-authoring-presets.ts";
import type { RuleAuthoringObject } from "./rule-authoring-types.ts";

export interface RuleAuthoringNavigationProps {
  overview: TemplateGovernanceWorkbenchOverview | null;
  selectedRuleObject: RuleAuthoringObject;
  selectedModule: "screening" | "editing" | "proofreading";
  journalTemplateForm: {
    journalKey: string;
    journalName: string;
  };
  isBusy: boolean;
  onJournalScopeChange(journalTemplateId: string | null): void;
  onModuleChange(module: "screening" | "editing" | "proofreading"): void;
  onRuleObjectChange(ruleObject: RuleAuthoringObject): void;
  onSelectRuleSet(ruleSetId: string): void;
  onCreateRuleSet(event: FormEvent<HTMLFormElement>): void | Promise<void>;
  onCreateJournalTemplate(event: FormEvent<HTMLFormElement>): void | Promise<void>;
  onJournalTemplateFormChange(
    next: RuleAuthoringNavigationProps["journalTemplateForm"],
  ): void;
  onActivateJournalTemplate(journalTemplateProfileId: string): void;
  onArchiveJournalTemplate(journalTemplateProfileId: string): void;
  onPublishRuleSet(ruleSetId: string): void;
}

export function RuleAuthoringNavigation({
  overview,
  selectedRuleObject,
  selectedModule,
  journalTemplateForm,
  isBusy,
  onJournalScopeChange,
  onModuleChange,
  onRuleObjectChange,
  onSelectRuleSet,
  onCreateRuleSet,
  onCreateJournalTemplate,
  onJournalTemplateFormChange,
  onActivateJournalTemplate,
  onArchiveJournalTemplate,
  onPublishRuleSet,
}: RuleAuthoringNavigationProps) {
  const presets = listRuleAuthoringPresets();
  const selectedJournalScopeValue =
    overview?.selectedJournalTemplateId ?? "__base__";

  return (
    <section className="template-governance-rule-layout-nav">
      <article className="template-governance-card">
        <div className="template-governance-panel-header">
          <div>
            <h3>Rule Authoring Navigator</h3>
            <p>
              Choose family scope, module, and rule object before editing the structured rule
              form.
            </p>
          </div>
        </div>

        {overview?.selectedTemplateFamily ? (
          <div className="template-governance-form-grid">
            <label className="template-governance-field">
              <span>Rule Scope</span>
              <select
                value={selectedJournalScopeValue}
                onChange={(event) =>
                  onJournalScopeChange(
                    event.target.value === "__base__" ? null : event.target.value,
                  )
                }
              >
                <option value="__base__">Base Family Rules</option>
                {overview.journalTemplateProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.journal_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="template-governance-field">
              <span>Module</span>
              <select
                value={selectedModule}
                onChange={(event) =>
                  onModuleChange(
                    event.target.value as RuleAuthoringNavigationProps["selectedModule"],
                  )
                }
              >
                <option value="screening">screening</option>
                <option value="editing">editing</option>
                <option value="proofreading">proofreading</option>
              </select>
            </label>
            <div className="template-governance-actions template-governance-actions-full">
              <form onSubmit={onCreateRuleSet}>
                <button type="submit" disabled={isBusy}>
                  {isBusy ? "Saving..." : "Create Rule Set Draft"}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <p className="template-governance-empty">
            Select a template family before navigating rule authoring.
          </p>
        )}
      </article>

      <article className="template-governance-card">
        <h4>Rule Objects</h4>
        <div className="template-governance-rule-object-list">
          {presets.map((preset) => {
            const isActive = preset.object === selectedRuleObject;
            return (
              <button
                key={preset.object}
                type="button"
                className={`template-governance-list-button${isActive ? " is-active" : ""}`}
                onClick={() => onRuleObjectChange(preset.object)}
              >
                <span>{preset.objectLabel}</span>
                <small>{preset.description}</small>
              </button>
            );
          })}
        </div>
      </article>

      <article className="template-governance-card">
        <div className="template-governance-panel-header">
          <div>
            <h4>Journal Template Profiles</h4>
            <p>
              Manage journal-level overlays that refine the base medical manuscript family.
            </p>
          </div>
        </div>
        {overview?.selectedTemplateFamily ? (
          <>
            <form className="template-governance-form-grid" onSubmit={onCreateJournalTemplate}>
              <label className="template-governance-field">
                <span>Journal Name</span>
                <input
                  value={journalTemplateForm.journalName}
                  onChange={(event) =>
                    onJournalTemplateFormChange({
                      ...journalTemplateForm,
                      journalName: event.target.value,
                    })
                  }
                  placeholder="\u300a\u4e2d\u897f\u533b\u7ed3\u5408\u6742\u5fd7\u300b"
                />
              </label>
              <label className="template-governance-field">
                <span>Journal Key</span>
                <input
                  value={journalTemplateForm.journalKey}
                  onChange={(event) =>
                    onJournalTemplateFormChange({
                      ...journalTemplateForm,
                      journalKey: event.target.value,
                    })
                  }
                  placeholder="zxyjhzz"
                />
              </label>
              <div className="template-governance-actions template-governance-actions-full">
                <button type="submit" disabled={isBusy}>
                  {isBusy ? "Saving..." : "Create Journal Template"}
                </button>
              </div>
            </form>

            {overview.journalTemplateProfiles.length > 0 ? (
              <div className="template-governance-stack">
                {overview.journalTemplateProfiles.map((profile) => (
                  <JournalTemplateProfileCard
                    key={profile.id}
                    profile={profile}
                    isSelected={profile.id === overview.selectedJournalTemplateId}
                    isBusy={isBusy}
                    onSelectRuleScope={onJournalScopeChange}
                    onActivateJournalTemplate={onActivateJournalTemplate}
                    onArchiveJournalTemplate={onArchiveJournalTemplate}
                  />
                ))}
              </div>
            ) : (
              <p className="template-governance-empty">
                No journal template profiles exist for this family yet.
              </p>
            )}
          </>
        ) : (
          <p className="template-governance-empty">
            Select a template family before creating journal template profiles.
          </p>
        )}
      </article>

      <article className="template-governance-card">
        <div className="template-governance-panel-header">
          <div>
            <h4>Rule Sets</h4>
            <p>
              Work from the draft or published rule-set version that belongs to the selected
              family scope and module.
            </p>
          </div>
        </div>
        {overview?.ruleSets.length ? (
          <div className="template-governance-stack">
            {overview.ruleSets.map((ruleSet) => (
              <RuleSetCard
                key={ruleSet.id}
                ruleSet={ruleSet}
                isSelected={ruleSet.id === overview.selectedRuleSetId}
                isBusy={isBusy}
                onSelectRuleSet={onSelectRuleSet}
                onPublishRuleSet={onPublishRuleSet}
              />
            ))}
          </div>
        ) : (
          <p className="template-governance-empty">
            No rule sets exist for the current family scope and module yet.
          </p>
        )}
      </article>
    </section>
  );
}

function JournalTemplateProfileCard({
  profile,
  isSelected,
  isBusy,
  onSelectRuleScope,
  onActivateJournalTemplate,
  onArchiveJournalTemplate,
}: {
  profile: NonNullable<TemplateGovernanceWorkbenchOverview["journalTemplateProfiles"]>[number];
  isSelected: boolean;
  isBusy: boolean;
  onSelectRuleScope: (journalTemplateId: string | null) => void;
  onActivateJournalTemplate: (journalTemplateProfileId: string) => void;
  onArchiveJournalTemplate: (journalTemplateProfileId: string) => void;
}) {
  return (
    <article className="template-governance-card">
      <strong>{profile.journal_name}</strong>
      <small>
        {profile.journal_key} | {profile.status}
      </small>
      <div className="template-governance-actions">
        <button type="button" disabled={isBusy} onClick={() => onSelectRuleScope(profile.id)}>
          {isSelected ? "Selected Scope" : "Use As Scope"}
        </button>
        {profile.status !== "active" ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onActivateJournalTemplate(profile.id)}
          >
            Activate
          </button>
        ) : (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onArchiveJournalTemplate(profile.id)}
          >
            Archive
          </button>
        )}
      </div>
    </article>
  );
}

function RuleSetCard({
  ruleSet,
  isSelected,
  isBusy,
  onSelectRuleSet,
  onPublishRuleSet,
}: {
  ruleSet: EditorialRuleSetViewModel;
  isSelected: boolean;
  isBusy: boolean;
  onSelectRuleSet: (ruleSetId: string) => void;
  onPublishRuleSet: (ruleSetId: string) => void;
}) {
  return (
    <article className="template-governance-card">
      <strong>
        {ruleSet.module} rule set v{ruleSet.version_no}
      </strong>
      <small>
        {ruleSet.status}
        {ruleSet.journal_template_id ? ` | journal:${ruleSet.journal_template_id}` : " | base"}
      </small>
      <div className="template-governance-actions">
        <button type="button" disabled={isBusy} onClick={() => onSelectRuleSet(ruleSet.id)}>
          {isSelected ? "Active Rule Set" : "Open Rule Set"}
        </button>
        {ruleSet.status === "draft" ? (
          <button type="button" disabled={isBusy} onClick={() => onPublishRuleSet(ruleSet.id)}>
            Publish Rule Set
          </button>
        ) : null}
      </div>
    </article>
  );
}
