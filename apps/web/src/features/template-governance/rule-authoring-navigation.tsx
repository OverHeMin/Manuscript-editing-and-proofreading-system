import type { FormEvent } from "react";
import type { EditorialRuleSetViewModel } from "../editorial-rules/index.ts";
import type {
  TemplateGovernanceWorkbenchOverview,
} from "./template-governance-controller.ts";
import { listRuleAuthoringPresets } from "./rule-authoring-presets.ts";
import type { RuleAuthoringObject } from "./rule-authoring-types.ts";
import {
  formatTemplateGovernanceGovernedAssetStatusLabel,
  formatTemplateGovernanceModuleLabel,
} from "./template-governance-display.ts";

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
            <h3>规则导航</h3>
            <p>
              先选规则范围、模块和规则对象，再进入结构化规则编辑。
            </p>
          </div>
        </div>

        {overview?.selectedTemplateFamily ? (
          <div className="template-governance-form-grid">
            <label className="template-governance-field">
              <span>规则范围</span>
              <select
                value={selectedJournalScopeValue}
                onChange={(event) =>
                  onJournalScopeChange(
                    event.target.value === "__base__" ? null : event.target.value,
                  )
                }
              >
                <option value="__base__">模板族基础规则</option>
                {overview.journalTemplateProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.journal_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="template-governance-field">
              <span>模块</span>
              <select
                value={selectedModule}
                onChange={(event) =>
                  onModuleChange(
                    event.target.value as RuleAuthoringNavigationProps["selectedModule"],
                  )
                }
              >
                <option value="screening">初筛</option>
                <option value="editing">编辑</option>
                <option value="proofreading">校对</option>
              </select>
            </label>
            <div className="template-governance-actions template-governance-actions-full">
              <form onSubmit={onCreateRuleSet}>
                <button type="submit" disabled={isBusy}>
                  {isBusy ? "保存中..." : "新建规则集草稿"}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <p className="template-governance-empty">
            先选择模板族，再使用规则导航。
          </p>
        )}
      </article>

      <article className="template-governance-card">
        <h4>规则对象</h4>
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
            <h4>期刊模板画像</h4>
            <p>
              管理期刊层加层规则，用于细化模板族基础要求。
            </p>
          </div>
        </div>
        {overview?.selectedTemplateFamily ? (
          <>
            <form className="template-governance-form-grid" onSubmit={onCreateJournalTemplate}>
              <label className="template-governance-field">
                <span>期刊名称</span>
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
                <span>期刊标识</span>
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
                  {isBusy ? "保存中..." : "新建期刊模板"}
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
                当前模板族还没有期刊模板画像。
              </p>
            )}
          </>
        ) : (
          <p className="template-governance-empty">
            先选择模板族，再创建期刊模板画像。
          </p>
        )}
      </article>

      <article className="template-governance-card">
        <div className="template-governance-panel-header">
          <div>
            <h4>规则集</h4>
            <p>
              只在当前模板范围和模块对应的规则集版本上工作，避免串改别的治理范围。
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
            当前模板范围和模块下还没有规则集。
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
        {profile.journal_key} | {formatTemplateGovernanceGovernedAssetStatusLabel(profile.status)}
      </small>
      <div className="template-governance-actions">
        <button type="button" disabled={isBusy} onClick={() => onSelectRuleScope(profile.id)}>
          {isSelected ? "当前范围" : "设为当前范围"}
        </button>
        {profile.status !== "active" ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onActivateJournalTemplate(profile.id)}
          >
            启用
          </button>
        ) : (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onArchiveJournalTemplate(profile.id)}
          >
            归档
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
        {formatTemplateGovernanceModuleLabel(ruleSet.module)} 规则集 v{ruleSet.version_no}
      </strong>
      <small>
        {formatTemplateGovernanceGovernedAssetStatusLabel(ruleSet.status)}
        {ruleSet.journal_template_id
          ? ` | 期刊:${ruleSet.journal_template_id}`
          : " | 模板族基础"}
      </small>
      <div className="template-governance-actions">
        <button type="button" disabled={isBusy} onClick={() => onSelectRuleSet(ruleSet.id)}>
          {isSelected ? "当前规则集" : "打开规则集"}
        </button>
        {ruleSet.status === "draft" ? (
          <button type="button" disabled={isBusy} onClick={() => onPublishRuleSet(ruleSet.id)}>
            发布规则集
          </button>
        ) : null}
      </div>
    </article>
  );
}
