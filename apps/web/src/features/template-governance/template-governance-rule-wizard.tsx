import { useEffect, useState } from "react";
import { BrowserHttpClientError, createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import type { ManuscriptType } from "../manuscripts/types.ts";
import {
  createRuleWizardConfirmFormState,
  createRuleWizardEntryFormState,
  createRuleWizardSemanticViewModel,
  confirmRuleWizardSemanticLayer,
  regenerateRuleWizardSemanticLayer,
  type RuleWizardConfirmFormState,
  type RuleWizardEntryFormState,
} from "./template-governance-rule-wizard-api.ts";
import { TemplateGovernanceRuleWizardStepConfirm } from "./template-governance-rule-wizard-step-confirm.tsx";
import { TemplateGovernanceRuleWizardStepEntry } from "./template-governance-rule-wizard-step-entry.tsx";
import { TemplateGovernanceRuleWizardStepSemantic } from "./template-governance-rule-wizard-step-semantic.tsx";
import {
  getNextRuleWizardStep,
  getPreviousRuleWizardStep,
  getRuleWizardStepLabel,
  getRuleWizardStepLabels,
  type RuleWizardState,
} from "./template-governance-rule-wizard-state.ts";

const defaultRuleWizardClient = createBrowserHttpClient();

export interface TemplateGovernanceRuleWizardProps {
  state: RuleWizardState;
  title?: string;
  entryFormState?: RuleWizardEntryFormState;
  onEntryFormChange?: (nextValue: RuleWizardEntryFormState) => void;
  onBack?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onSaveDraft?: () => void;
  onComplete?: () => void;
}

export function TemplateGovernanceRuleWizard({
  state,
  title,
  entryFormState = createRuleWizardEntryFormState(),
  onEntryFormChange,
  onBack,
  onPrevious,
  onNext,
  onSaveDraft,
  onComplete,
}: TemplateGovernanceRuleWizardProps) {
  const nextStep = getNextRuleWizardStep(state.step);
  const previousStep = getPreviousRuleWizardStep(state.step);
  const [semanticRevision, setSemanticRevision] = useState<
    Awaited<ReturnType<typeof regenerateRuleWizardSemanticLayer>>["revision"] | undefined
  >();
  const [semanticSuggestion, setSemanticSuggestion] = useState<
    Parameters<typeof createRuleWizardSemanticViewModel>[0]["suggestion"]
  >();
  const [isSemanticBusy, setIsSemanticBusy] = useState(false);
  const [semanticErrorMessage, setSemanticErrorMessage] = useState<string | null>(null);
  const [awaitingSemanticDraft, setAwaitingSemanticDraft] = useState(false);
  const [confirmDirty, setConfirmDirty] = useState(false);
  const [confirmFormState, setConfirmFormState] = useState<RuleWizardConfirmFormState>(
    () => createRuleWizardConfirmFormState({ form: entryFormState }),
  );

  const semanticViewModel = createRuleWizardSemanticViewModel({
    form: entryFormState,
    revision: semanticRevision,
    suggestion: semanticSuggestion,
  });

  useEffect(() => {
    setSemanticRevision(undefined);
    setSemanticSuggestion(undefined);
    setSemanticErrorMessage(null);
    setAwaitingSemanticDraft(false);
    setConfirmDirty(false);
    setConfirmFormState(createRuleWizardConfirmFormState({ form: entryFormState }));
  }, [state.mode, state.sourceRowId, title]);

  useEffect(() => {
    if (!confirmDirty) {
      setConfirmFormState(
        createRuleWizardConfirmFormState({
          form: entryFormState,
          revision: semanticRevision,
          suggestion: semanticSuggestion,
        }),
      );
    }
  }, [confirmDirty, entryFormState, semanticRevision, semanticSuggestion]);

  useEffect(() => {
    if (!awaitingSemanticDraft || !state.draftRevisionId || isSemanticBusy) {
      return;
    }

    void handleRegenerateSemanticLayer();
  }, [awaitingSemanticDraft, isSemanticBusy, state.draftRevisionId]);

  useEffect(() => {
    if (
      state.step !== "semantic" ||
      !state.draftRevisionId ||
      semanticRevision?.id === state.draftRevisionId ||
      isSemanticBusy
    ) {
      return;
    }

    void handleRegenerateSemanticLayer();
  }, [isSemanticBusy, semanticRevision?.id, state.draftRevisionId, state.step]);

  async function handleRegenerateSemanticLayer() {
    if (!state.draftRevisionId) {
      setSemanticErrorMessage("请先保存基础录入草稿，再生成 AI 语义层。");
      setAwaitingSemanticDraft(true);
      onSaveDraft?.();
      return;
    }

    setIsSemanticBusy(true);
    setSemanticErrorMessage(null);

    try {
      const result = await regenerateRuleWizardSemanticLayer(
        defaultRuleWizardClient,
        state.draftRevisionId,
        entryFormState,
      );
      setSemanticRevision(result.revision);
      setSemanticSuggestion(result.suggestion);
      setConfirmDirty(false);
      setConfirmFormState(
        createRuleWizardConfirmFormState({
          form: entryFormState,
          revision: result.revision,
          suggestion: result.suggestion,
        }),
      );
      setAwaitingSemanticDraft(false);
    } catch (error) {
      setSemanticErrorMessage(resolveWizardErrorMessage(error, "AI 语义识别失败"));
    } finally {
      setIsSemanticBusy(false);
    }
  }

  async function handleConfirmSemanticLayer(): Promise<boolean> {
    if (!state.draftRevisionId) {
      setSemanticErrorMessage("请先保存基础录入草稿，再确认 AI 结果。");
      onSaveDraft?.();
      return false;
    }

    setIsSemanticBusy(true);
    setSemanticErrorMessage(null);

    try {
      const result = await confirmRuleWizardSemanticLayer(
        defaultRuleWizardClient,
        state.draftRevisionId,
        entryFormState,
        confirmFormState,
      );
      setSemanticRevision(result.detail.selected_revision);
      setSemanticSuggestion({
        suggestedSemanticLayer: {
          pageSummary: result.semanticViewModel.semanticSummary,
          retrievalTerms: result.semanticViewModel.retrievalTerms
            .split(",")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
          retrievalSnippets: result.semanticViewModel.retrievalSnippets
            .split(/\r?\n/)
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
        },
        suggestedFieldPatch: {
          summary: result.semanticViewModel.semanticSummary,
          moduleScope: result.semanticViewModel.moduleScope,
          manuscriptTypes: parseWizardManuscriptTypes(
            result.semanticViewModel.manuscriptTypes,
          ),
          riskTags: [result.semanticViewModel.ruleType, result.semanticViewModel.riskLevel],
        },
        warnings: [],
      });
      setConfirmDirty(false);
      return true;
    } catch (error) {
      setSemanticErrorMessage(resolveWizardErrorMessage(error, "人工确认 AI 结果失败"));
      return false;
    } finally {
      setIsSemanticBusy(false);
    }
  }

  function handleConfirmFormChange(nextValue: RuleWizardConfirmFormState) {
    setConfirmFormState(nextValue);
    setConfirmDirty(true);
  }

  async function handleSaveDraftClick() {
    if (state.step === "confirm") {
      const confirmed = await handleConfirmSemanticLayer();
      if (!confirmed) {
        return;
      }
    }

    onSaveDraft?.();
  }

  async function handleNextClick() {
    if (state.step === "semantic" && !state.draftRevisionId) {
      setSemanticErrorMessage("请先保存基础录入草稿，再继续到人工确认。");
      setAwaitingSemanticDraft(true);
      onSaveDraft?.();
      return;
    }

    if (state.step === "confirm") {
      const confirmed = await handleConfirmSemanticLayer();
      if (!confirmed) {
        return;
      }
    }

    onNext?.();
  }

  return (
    <section className="template-governance-rule-wizard">
      <header className="template-governance-ledger-toolbar">
        <div className="template-governance-ledger-toolbar-copy">
          <p className="template-governance-eyebrow">规则向导</p>
          <h1>{resolveWizardTitle(state.mode, title)}</h1>
          <p>用统一五步完成录入、语义确认、绑定和发布，不再把复杂编辑留在台账页里。</p>
        </div>
        <div className="template-governance-ledger-toolbar-actions template-governance-ledger-toolbar-actions--comfortable">
          <button type="button" onClick={onBack}>
            返回规则台账
          </button>
        </div>
      </header>

      <article className="template-governance-card template-governance-ledger-section">
        <header className="template-governance-ledger-section-header">
          <h2>五步流</h2>
          <p>当前步骤聚焦一个治理决定，低频高级项后续放入抽屉，不占壳层顶部。</p>
        </header>
        <ol className="template-governance-list">
          {getRuleWizardStepLabels().map((label) => (
            <li key={label}>
              <div
                className={`template-governance-list-button${
                  label === getRuleWizardStepLabel(state.step) ? " is-active" : ""
                }`}
                aria-current={
                  label === getRuleWizardStepLabel(state.step) ? "step" : undefined
                }
              >
                <span>{label}</span>
                <small>
                  {label === getRuleWizardStepLabel(state.step) ? "当前步骤" : "待完成"}
                </small>
              </div>
            </li>
          ))}
        </ol>
      </article>

      {renderWizardBody({
        state,
        entryFormState,
        semanticViewModel,
        confirmFormState,
        isSemanticBusy,
        semanticErrorMessage,
        onEntryFormChange,
        onPrevious,
        onRegenerateSemanticLayer: () => {
          void handleRegenerateSemanticLayer();
        },
        onConfirmFormChange: handleConfirmFormChange,
        onAcceptHighConfidence: () => {
          setConfirmFormState(
            createRuleWizardConfirmFormState({
              form: entryFormState,
              revision: semanticRevision,
              suggestion: semanticSuggestion,
            }),
          );
          setConfirmDirty(false);
        },
      })}

      <footer className="template-governance-actions">
        {previousStep ? (
          <button type="button" onClick={onPrevious}>
            上一步
          </button>
        ) : null}
        <button type="button" onClick={() => void handleSaveDraftClick()}>
          保存草稿
        </button>
        <button type="button" onClick={() => void handleNextClick()}>
          下一步：{nextStep ? getRuleWizardStepLabel(nextStep) : "保存与发布"}
        </button>
        <button type="button" onClick={onComplete}>
          完成并返回规则中心
        </button>
      </footer>
    </section>
  );
}

function renderWizardBody(input: {
  state: RuleWizardState;
  entryFormState: RuleWizardEntryFormState;
  semanticViewModel: ReturnType<typeof createRuleWizardSemanticViewModel>;
  confirmFormState: RuleWizardConfirmFormState;
  isSemanticBusy: boolean;
  semanticErrorMessage: string | null;
  onEntryFormChange?: (nextValue: RuleWizardEntryFormState) => void;
  onPrevious?: () => void;
  onRegenerateSemanticLayer: () => void;
  onConfirmFormChange: (nextValue: RuleWizardConfirmFormState) => void;
  onAcceptHighConfidence: () => void;
}) {
  switch (input.state.step) {
    case "entry":
      return (
        <TemplateGovernanceRuleWizardStepEntry
          value={input.entryFormState}
          onChange={(nextValue) => input.onEntryFormChange?.(nextValue)}
        />
      );
    case "semantic":
      return (
        <TemplateGovernanceRuleWizardStepSemantic
          value={input.semanticViewModel}
          isBusy={input.isSemanticBusy}
          errorMessage={input.semanticErrorMessage}
          onRegenerate={input.onRegenerateSemanticLayer}
          onBackToEvidence={input.onPrevious}
        />
      );
    case "confirm":
      return (
        <TemplateGovernanceRuleWizardStepConfirm
          value={input.confirmFormState}
          suggestion={input.semanticViewModel}
          isBusy={input.isSemanticBusy}
          errorMessage={input.semanticErrorMessage}
          onChange={input.onConfirmFormChange}
          onAcceptHighConfidence={input.onAcceptHighConfidence}
        />
      );
    default:
      return (
        <article className="template-governance-card template-governance-ledger-section">
          <header className="template-governance-ledger-section-header">
            <h2>{getRuleWizardStepLabel(input.state.step)}</h2>
            <p>{resolveWizardStepHint(input.state.step)}</p>
          </header>
          <div className="template-governance-detail-grid">
            <div>
              <span>当前模式</span>
              <p>{resolveWizardModeLabel(input.state.mode)}</p>
            </div>
            <div>
              <span>草稿状态</span>
              <p>{input.state.dirty ? "有未保存变更" : "已同步"}</p>
            </div>
            <div>
              <span>来源记录</span>
              <p>从统一规则台账打开</p>
            </div>
            <div>
              <span>下一步</span>
              <p>
                {getNextRuleWizardStep(input.state.step)
                  ? getRuleWizardStepLabel(getNextRuleWizardStep(input.state.step)!)
                  : "保存与发布"}
              </p>
            </div>
          </div>
        </article>
      );
  }
}

function resolveWizardTitle(mode: RuleWizardState["mode"], title: string | undefined): string {
  if (title) {
    return title;
  }

  switch (mode) {
    case "edit":
      return "编辑规则";
    case "candidate":
      return "回流候选转规则";
    case "create":
    default:
      return "新建规则";
  }
}

function resolveWizardModeLabel(mode: RuleWizardState["mode"]): string {
  switch (mode) {
    case "edit":
      return "编辑已有规则";
    case "candidate":
      return "把回流候选转为规则";
    case "create":
    default:
      return "新建治理规则";
  }
}

function resolveWizardStepHint(step: RuleWizardState["step"]): string {
  switch (step) {
    case "binding":
      return "用业务语言决定它进入哪个模板族、规则包和执行模块。";
    case "publish":
    default:
      return "确认保存方式和回台账后的动作，让发布闭环保持短而清晰。";
  }
}

function resolveWizardErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof BrowserHttpClientError) {
    const body = error.responseBody;
    if (body && typeof body === "object" && "message" in body) {
      const message = (body as { message?: unknown }).message;
      if (typeof message === "string" && message.trim().length > 0) {
        return message;
      }
    }

    return `${fallback}（HTTP ${error.status}）`;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function parseWizardManuscriptTypes(value: string): ManuscriptType[] | "any" {
  if (value.trim().toLowerCase() === "any" || value.trim().length === 0) {
    return "any";
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry): entry is ManuscriptType => entry.length > 0);
}
