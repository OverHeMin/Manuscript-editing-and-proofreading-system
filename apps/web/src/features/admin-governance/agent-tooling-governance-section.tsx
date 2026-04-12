import { useEffect, useState } from "react";
import type { AgentExecutionLogViewModel } from "../agent-execution/index.ts";
import type { AuthRole } from "../auth/index.ts";
import type { AgentProfileRoleKey } from "../agent-profiles/index.ts";
import type { AgentRuntimeAdapter } from "../agent-runtime/index.ts";
import type { ManuscriptType } from "../manuscripts/index.ts";
import {
  formatRoutingPolicyScopeKindLabel,
  type ModelRoutingPolicyEvidenceLinkViewModel,
  type ModelRoutingPolicyScopeKind,
  type ModelRoutingPolicyVersionViewModel,
} from "../model-routing-governance/index.ts";
import type { SandboxMode } from "../sandbox-profiles/index.ts";
import type { TemplateModule } from "../templates/index.ts";
import type {
  ToolGatewayAccessMode,
  ToolGatewayScope,
} from "../tool-gateway/index.ts";
import type {
  AdminGovernanceExecutionEvidence,
  AdminGovernanceOverview,
  AdminGovernanceWorkbenchController,
} from "./admin-governance-controller.ts";
import { AgentExecutionEvidenceView } from "./agent-execution-evidence-view.tsx";
import { RuntimeBindingQualityPackageEditor } from "./runtime-binding-quality-package-editor.tsx";

const templateModules: TemplateModule[] = ["screening", "editing", "proofreading"];
const manuscriptTypes: ManuscriptType[] = [
  "clinical_study",
  "review",
  "systematic_review",
  "meta_analysis",
  "case_report",
  "guideline_interpretation",
  "expert_consensus",
  "diagnostic_study",
  "basic_research",
  "nursing_study",
  "methodology_paper",
  "brief_report",
  "other",
];
const toolGatewayScopes: ToolGatewayScope[] = [
  "manuscripts",
  "assets",
  "knowledge",
  "templates",
  "audit",
  "browser_qa",
  "benchmark",
  "deploy_verification",
];
const toolAccessModes: ToolGatewayAccessMode[] = ["read", "write"];
const sandboxModes: SandboxMode[] = ["read_only", "workspace_write", "full_access"];
const agentProfileRoleKeys: AgentProfileRoleKey[] = ["superpowers", "gstack", "subagent"];
const agentRuntimeAdapters: AgentRuntimeAdapter[] = ["internal_prompt", "deepagents"];
const executionStatusFilters = ["all", "running", "completed", "failed", "queued"] as const;

type AgentExecutionStatusFilter = (typeof executionStatusFilters)[number];

export interface AgentToolingGovernanceSectionProps {
  actorRole: AuthRole;
  controller: AdminGovernanceWorkbenchController;
  overview: AdminGovernanceOverview;
  isMutating: boolean;
  runMutation(work: () => Promise<void>): Promise<void>;
  onOverviewChange(overview: AdminGovernanceOverview, statusMessage: string): void;
}

export function AgentToolingGovernanceSection({
  actorRole,
  controller,
  overview,
  isMutating,
  runMutation,
  onOverviewChange,
}: AgentToolingGovernanceSectionProps) {
  const [toolForm, setToolForm] = useState({
    name: "knowledge_search",
    scope: "knowledge" as ToolGatewayScope,
    accessMode: "read" as ToolGatewayAccessMode,
  });
  const [sandboxForm, setSandboxForm] = useState({
    name: "review-safe",
    sandboxMode: "workspace_write" as SandboxMode,
    networkAccess: true,
    approvalRequired: false,
    allowedToolIds: [] as string[],
  });
  const [agentProfileForm, setAgentProfileForm] = useState({
    name: "Senior reviewer",
    roleKey: "gstack" as AgentProfileRoleKey,
    moduleScopeMode: "selected" as "any" | "selected",
    moduleScope: ["editing"] as TemplateModule[],
    manuscriptTypeMode: "selected" as "any" | "selected",
    manuscriptTypes: ["review"] as ManuscriptType[],
    description: "Governed manuscript reviewer profile.",
  });
  const [runtimeForm, setRuntimeForm] = useState({
    name: "Deepagents primary",
    adapter: "deepagents" as AgentRuntimeAdapter,
    sandboxProfileId: "",
    allowedModules: ["editing"] as TemplateModule[],
    runtimeSlot: "primary",
  });
  const [policyForm, setPolicyForm] = useState({
    name: "review-policy",
    defaultMode: "read" as ToolGatewayAccessMode,
    allowedToolIds: [] as string[],
    highRiskToolIds: [] as string[],
    writeRequiresConfirmation: true,
  });
  const [bindingForm, setBindingForm] = useState({
    module: "editing" as TemplateModule,
    templateFamilyId: "",
    runtimeId: "",
    sandboxProfileId: "",
    agentProfileId: "",
    toolPermissionPolicyId: "",
    promptTemplateId: "",
    skillPackageIds: [] as string[],
    qualityPackageVersionIds: [] as string[],
    executionProfileId: "",
    verificationCheckProfileIds: [] as string[],
    evaluationSuiteIds: [] as string[],
    releaseCheckProfileId: "",
  });
  const [selectedExecutionLogId, setSelectedExecutionLogId] = useState("");
  const [routingDraftForm, setRoutingDraftForm] = useState({
    scopeKind: "template_family" as ModelRoutingPolicyScopeKind,
    scopeValue: "",
    primaryModelId: "",
    fallbackModelIds: [] as string[],
    evidenceLinksText: "evaluation_run:run-1",
    notes: "Evidence-linked routing governance draft.",
  });
  const [routingDraftEditors, setRoutingDraftEditors] = useState<
    Record<
      string,
      {
        primaryModelId: string;
        fallbackModelIds: string[];
        evidenceLinksText: string;
        notes: string;
      }
    >
  >({});
  const [executionStatusFilter, setExecutionStatusFilter] =
    useState<AgentExecutionStatusFilter>("all");
  const [executionSearchValue, setExecutionSearchValue] = useState("");
  const [executionEvidence, setExecutionEvidence] =
    useState<AdminGovernanceExecutionEvidence | null>(null);
  const [executionEvidenceError, setExecutionEvidenceError] = useState<string | null>(null);
  const [isExecutionEvidenceLoading, setIsExecutionEvidenceLoading] = useState(false);

  useEffect(() => {
    const firstToolId = overview.toolGatewayTools[0]?.id ?? "";
    setSandboxForm((current) => ({
      ...current,
      allowedToolIds: syncMultiSelection(current.allowedToolIds, overview.toolGatewayTools, firstToolId),
    }));
    setPolicyForm((current) => ({
      ...current,
      allowedToolIds: syncMultiSelection(current.allowedToolIds, overview.toolGatewayTools, firstToolId),
      highRiskToolIds: current.highRiskToolIds.filter((toolId) =>
        overview.toolGatewayTools.some((tool) => tool.id === toolId),
      ),
    }));
  }, [overview.toolGatewayTools]);

  useEffect(() => {
    const firstExecutionLogId = getVisibleAgentExecutionLogs(overview.agentExecutionLogs, {
      statusFilter: "all",
      searchValue: "",
      limit: overview.agentExecutionLogs.length,
    })[0]?.id ?? "";
    setSelectedExecutionLogId((current) =>
      syncSingleSelection(current, overview.agentExecutionLogs, firstExecutionLogId),
    );
  }, [overview.agentExecutionLogs]);

  useEffect(() => {
    const firstModelId = overview.modelRegistryEntries[0]?.id ?? "";
    setRoutingDraftForm((current) => ({
      ...current,
      scopeValue:
        current.scopeKind === "template_family"
          ? current.scopeValue || overview.selectedTemplateFamilyId || overview.templateFamilies[0]?.id || ""
          : current.scopeValue || "editing",
      primaryModelId: syncSingleSelection(
        current.primaryModelId,
        overview.modelRegistryEntries,
        firstModelId,
      ),
      fallbackModelIds: syncMultiSelection(
        current.fallbackModelIds,
        overview.modelRegistryEntries,
      ),
    }));
  }, [
    overview.modelRegistryEntries,
    overview.selectedTemplateFamilyId,
    overview.templateFamilies,
  ]);

  useEffect(() => {
    setRoutingDraftEditors((current) => {
      const next: typeof current = {};

      for (const policy of overview.routingPolicies) {
        const latestVersion = getLatestRoutingPolicyVersion(policy);
        if (!latestVersion) {
          continue;
        }

        const existing = current[latestVersion.id];
        next[latestVersion.id] =
          existing ??
          buildRoutingDraftEditorState(latestVersion);
      }

      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(next);
      if (
        currentKeys.length === nextKeys.length &&
        currentKeys.every((key) => nextKeys.includes(key))
      ) {
        return current;
      }

      return next;
    });
  }, [overview.routingPolicies]);

  useEffect(() => {
    const firstSandboxId = overview.sandboxProfiles[0]?.id ?? "";
    const firstAgentProfileId = overview.agentProfiles[0]?.id ?? "";
    const firstRuntimeId = overview.agentRuntimes[0]?.id ?? "";
    const firstPolicyId = overview.toolPermissionPolicies[0]?.id ?? "";
    const selectedTemplateFamilyId = overview.selectedTemplateFamilyId ?? "";

    setRuntimeForm((current) => ({
      ...current,
      sandboxProfileId: syncSingleSelection(current.sandboxProfileId, overview.sandboxProfiles, firstSandboxId),
    }));
    setBindingForm((current) => ({
      ...current,
      templateFamilyId: syncSingleSelection(current.templateFamilyId, overview.templateFamilies, selectedTemplateFamilyId),
      runtimeId: syncSingleSelection(current.runtimeId, overview.agentRuntimes, firstRuntimeId),
      sandboxProfileId: syncSingleSelection(current.sandboxProfileId, overview.sandboxProfiles, firstSandboxId),
      agentProfileId: syncSingleSelection(current.agentProfileId, overview.agentProfiles, firstAgentProfileId),
      toolPermissionPolicyId: syncSingleSelection(current.toolPermissionPolicyId, overview.toolPermissionPolicies, firstPolicyId),
    }));
  }, [
    overview.agentProfiles,
    overview.agentRuntimes,
    overview.sandboxProfiles,
    overview.selectedTemplateFamilyId,
    overview.templateFamilies,
    overview.toolPermissionPolicies,
  ]);

  useEffect(() => {
    const eligiblePromptTemplates = getEligiblePromptTemplates(overview, bindingForm.module, bindingForm.templateFamilyId);
    const eligibleSkillPackages = getEligibleSkillPackages(overview, bindingForm.module);
    const eligibleQualityPackages = getEligibleQualityPackages(overview);
    const eligibleExecutionProfiles = getEligibleExecutionProfiles(overview, bindingForm.module, bindingForm.templateFamilyId);
    const eligibleVerificationCheckProfiles = getEligibleVerificationCheckProfiles(overview);
    const eligibleEvaluationSuites = getEligibleEvaluationSuites(overview, bindingForm.module);
    const eligibleReleaseCheckProfiles = getEligibleReleaseCheckProfiles(
      overview,
      bindingForm.verificationCheckProfileIds,
    );

    setBindingForm((current) => {
      const promptTemplateId = syncSingleSelection(
        current.promptTemplateId,
        eligiblePromptTemplates,
        eligiblePromptTemplates[0]?.id ?? "",
      );
      const skillPackageIds = syncMultiSelection(
        current.skillPackageIds,
        eligibleSkillPackages,
      );
      const qualityPackageVersionIds = syncMultiSelection(
        current.qualityPackageVersionIds,
        eligibleQualityPackages,
      );
      const executionProfileId = syncSingleSelection(
        current.executionProfileId,
        eligibleExecutionProfiles,
        eligibleExecutionProfiles[0]?.id ?? "",
      );
      const verificationCheckProfileIds = syncMultiSelection(
        current.verificationCheckProfileIds,
        eligibleVerificationCheckProfiles,
      );
      const evaluationSuiteIds = syncMultiSelection(
        current.evaluationSuiteIds,
        eligibleEvaluationSuites,
      );
      const releaseCheckProfileId = syncSingleSelection(
        current.releaseCheckProfileId,
        eligibleReleaseCheckProfiles,
      );

      if (
        promptTemplateId === current.promptTemplateId &&
        skillPackageIds === current.skillPackageIds &&
        qualityPackageVersionIds === current.qualityPackageVersionIds &&
        executionProfileId === current.executionProfileId &&
        verificationCheckProfileIds === current.verificationCheckProfileIds &&
        evaluationSuiteIds === current.evaluationSuiteIds &&
        releaseCheckProfileId === current.releaseCheckProfileId
      ) {
        return current;
      }

      return {
        ...current,
        promptTemplateId,
        skillPackageIds,
        qualityPackageVersionIds,
        executionProfileId,
        verificationCheckProfileIds,
        evaluationSuiteIds,
        releaseCheckProfileId,
      };
    });
  }, [
    bindingForm.module,
    bindingForm.templateFamilyId,
    bindingForm.verificationCheckProfileIds,
    overview.evaluationSuites,
    overview.executionProfiles,
    overview.promptTemplates,
    overview.qualityPackages,
    overview.releaseCheckProfiles,
    overview.skillPackages,
    overview.templateFamilies,
    overview.verificationCheckProfiles,
  ]);

  useEffect(() => {
    if (selectedExecutionLogId.length === 0) {
      setExecutionEvidence(null);
      setExecutionEvidenceError(null);
      return;
    }

    let isActive = true;
    setIsExecutionEvidenceLoading(true);
    setExecutionEvidenceError(null);

    void controller
      .loadExecutionEvidence(selectedExecutionLogId)
      .then((nextEvidence) => {
        if (!isActive) {
          return;
        }

        setExecutionEvidence(nextEvidence);
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setExecutionEvidence(null);
        setExecutionEvidenceError(toExecutionEvidenceErrorMessage(error));
      })
      .finally(() => {
        if (isActive) {
          setIsExecutionEvidenceLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [controller, selectedExecutionLogId]);

  async function handleCreateTool() {
    await runMutation(async () => {
      const result = await controller.createToolGatewayToolAndReload({
        actorRole,
        name: toolForm.name.trim(),
        scope: toolForm.scope,
        accessMode: toolForm.accessMode,
      });

      onOverviewChange(result.overview, `Created tool gateway entry: ${result.createdTool.name}`);
    });
  }

  async function handleCreateSandboxProfile() {
    await runMutation(async () => {
      const result = await controller.createSandboxProfileAndReload({
        actorRole,
        name: sandboxForm.name.trim(),
        sandboxMode: sandboxForm.sandboxMode,
        networkAccess: sandboxForm.networkAccess,
        approvalRequired: sandboxForm.approvalRequired,
        allowedToolIds: sandboxForm.allowedToolIds,
      });

      onOverviewChange(result.overview, `Created sandbox profile: ${result.createdProfile.name}`);
    });
  }

  async function handleActivateSandboxProfile(profileId: string) {
    await runMutation(async () => {
      const nextOverview = await controller.activateSandboxProfileAndReload({
        actorRole,
        profileId,
        selectedTemplateFamilyId: overview.selectedTemplateFamilyId,
      });

      onOverviewChange(nextOverview, `Activated sandbox profile: ${profileId}`);
    });
  }

  async function handleCreateAgentProfile() {
    await runMutation(async () => {
      const result = await controller.createAgentProfileAndReload({
        actorRole,
        name: agentProfileForm.name.trim(),
        roleKey: agentProfileForm.roleKey,
        moduleScope:
          agentProfileForm.moduleScopeMode === "any"
            ? "any"
            : agentProfileForm.moduleScope,
        manuscriptTypes:
          agentProfileForm.manuscriptTypeMode === "any"
            ? "any"
            : agentProfileForm.manuscriptTypes,
        description: normalizeOptionalText(agentProfileForm.description),
      });

      onOverviewChange(result.overview, `Created agent profile: ${result.createdProfile.name}`);
    });
  }

  async function handlePublishAgentProfile(profileId: string) {
    await runMutation(async () => {
      const nextOverview = await controller.publishAgentProfileAndReload({
        actorRole,
        profileId,
        selectedTemplateFamilyId: overview.selectedTemplateFamilyId,
      });

      onOverviewChange(nextOverview, `Published agent profile: ${profileId}`);
    });
  }

  async function handleCreateRuntime() {
    await runMutation(async () => {
      const result = await controller.createAgentRuntimeAndReload({
        actorRole,
        name: runtimeForm.name.trim(),
        adapter: runtimeForm.adapter,
        sandboxProfileId: normalizeOptionalText(runtimeForm.sandboxProfileId),
        allowedModules: runtimeForm.allowedModules,
        runtimeSlot: normalizeOptionalText(runtimeForm.runtimeSlot),
      });

      onOverviewChange(result.overview, `Created agent runtime: ${result.createdRuntime.name}`);
    });
  }

  async function handlePublishRuntime(runtimeId: string) {
    await runMutation(async () => {
      const nextOverview = await controller.publishAgentRuntimeAndReload({
        actorRole,
        runtimeId,
        selectedTemplateFamilyId: overview.selectedTemplateFamilyId,
      });

      onOverviewChange(nextOverview, `Published runtime: ${runtimeId}`);
    });
  }

  async function handleCreateToolPermissionPolicy() {
    await runMutation(async () => {
      const result = await controller.createToolPermissionPolicyAndReload({
        actorRole,
        name: policyForm.name.trim(),
        defaultMode: policyForm.defaultMode,
        allowedToolIds: policyForm.allowedToolIds,
        highRiskToolIds: policyForm.highRiskToolIds,
        writeRequiresConfirmation: policyForm.writeRequiresConfirmation,
      });

      onOverviewChange(result.overview, `Created tool policy: ${result.createdPolicy.name}`);
    });
  }

  async function handleActivateToolPermissionPolicy(policyId: string) {
    await runMutation(async () => {
      const nextOverview = await controller.activateToolPermissionPolicyAndReload({
        actorRole,
        policyId,
        selectedTemplateFamilyId: overview.selectedTemplateFamilyId,
      });

      onOverviewChange(nextOverview, `Activated tool policy: ${policyId}`);
    });
  }

  async function handleCreateRuntimeBinding() {
    const selectedFamily = overview.templateFamilies.find(
      (family) => family.id === bindingForm.templateFamilyId,
    );
    if (!selectedFamily) {
      return;
    }

    await runMutation(async () => {
      const result = await controller.createRuntimeBindingAndReload({
        actorRole,
        module: bindingForm.module,
        manuscriptType: selectedFamily.manuscript_type,
        templateFamilyId: bindingForm.templateFamilyId,
        runtimeId: bindingForm.runtimeId,
        sandboxProfileId: bindingForm.sandboxProfileId,
        agentProfileId: bindingForm.agentProfileId,
        toolPermissionPolicyId: bindingForm.toolPermissionPolicyId,
        promptTemplateId: bindingForm.promptTemplateId,
        skillPackageIds: bindingForm.skillPackageIds,
        qualityPackageVersionIds: bindingForm.qualityPackageVersionIds,
        executionProfileId: normalizeOptionalText(bindingForm.executionProfileId),
        verificationCheckProfileIds: bindingForm.verificationCheckProfileIds,
        evaluationSuiteIds: bindingForm.evaluationSuiteIds,
        releaseCheckProfileId: normalizeOptionalText(bindingForm.releaseCheckProfileId),
      });

      onOverviewChange(result.overview, `Created runtime binding: ${result.createdBinding.id}`);
    });
  }

  const executionStatusCounts = countExecutionLogsByStatus(overview.agentExecutionLogs);
  const visibleExecutionLogs = getVisibleAgentExecutionLogs(overview.agentExecutionLogs, {
    statusFilter: executionStatusFilter,
    searchValue: executionSearchValue,
    limit: 6,
  });
  const selectedExecutionIsHidden =
    selectedExecutionLogId.length > 0 &&
    visibleExecutionLogs.every((log) => log.id !== selectedExecutionLogId) &&
    overview.agentExecutionLogs.some((log) => log.id === selectedExecutionLogId);
  const hasExecutionFilters =
    executionStatusFilter !== "all" || executionSearchValue.trim().length > 0;

  async function handleActivateRuntimeBinding(bindingId: string) {
    await runMutation(async () => {
      const nextOverview = await controller.activateRuntimeBindingAndReload({
        actorRole,
        bindingId,
        selectedTemplateFamilyId:
          bindingForm.templateFamilyId || overview.selectedTemplateFamilyId,
      });

      onOverviewChange(nextOverview, `Activated runtime binding: ${bindingId}`);
    });
  }

  async function handleCreateRoutingPolicyDraft() {
    await runMutation(async () => {
      const result = await controller.createRoutingPolicyAndReload({
        actorRole,
        scopeKind: routingDraftForm.scopeKind,
        scopeValue: routingDraftForm.scopeValue.trim(),
        primaryModelId: routingDraftForm.primaryModelId,
        fallbackModelIds: routingDraftForm.fallbackModelIds,
        evidenceLinks: parseRoutingEvidenceLinks(routingDraftForm.evidenceLinksText),
        notes: normalizeOptionalText(routingDraftForm.notes),
      });

      onOverviewChange(
        result.overview,
        `Created routing policy draft: ${result.createdPolicy.scope.scope_kind} / ${result.createdPolicy.scope.scope_value}`,
      );
    });
  }

  async function handleCreateRoutingPolicyVersion(policyId: string) {
    const policy = overview.routingPolicies.find((record) => record.policy_id === policyId);
    const sourceVersion = policy ? getLatestRoutingPolicyVersion(policy) : undefined;
    if (!sourceVersion) {
      return;
    }

    await runMutation(async () => {
      const nextOverview = await controller.createRoutingPolicyDraftVersionAndReload({
        actorRole,
        policyId,
        input: {
          primaryModelId: sourceVersion.primary_model_id,
          fallbackModelIds: sourceVersion.fallback_model_ids,
          evidenceLinks: sourceVersion.evidence_links,
          notes: sourceVersion.notes,
        },
      });

      onOverviewChange(nextOverview, `Created new routing draft version: ${policyId}`);
    });
  }

  async function handleSaveRoutingDraft(versionId: string) {
    const editor = routingDraftEditors[versionId];
    if (!editor) {
      return;
    }

    await runMutation(async () => {
      const nextOverview = await controller.saveRoutingPolicyDraftAndReload({
        actorRole,
        versionId,
        input: {
          primaryModelId: normalizeOptionalText(editor.primaryModelId),
          fallbackModelIds: editor.fallbackModelIds,
          evidenceLinks: parseRoutingEvidenceLinks(editor.evidenceLinksText),
          notes: normalizeOptionalText(editor.notes),
        },
      });

      onOverviewChange(nextOverview, `Saved routing policy draft: ${versionId}`);
    });
  }

  async function handleSubmitRoutingDraft(versionId: string) {
    await runMutation(async () => {
      const nextOverview = await controller.submitRoutingPolicyVersionAndReload({
        actorRole,
        versionId,
        reason: "Submit for review from Admin Governance Console.",
      });

      onOverviewChange(nextOverview, `Submitted routing policy draft: ${versionId}`);
    });
  }

  async function handleApproveRoutingVersion(versionId: string) {
    await runMutation(async () => {
      const nextOverview = await controller.approveRoutingPolicyVersionAndReload({
        actorRole,
        versionId,
        reason: "Approved in Admin Governance Console.",
      });

      onOverviewChange(nextOverview, `Approved routing policy version: ${versionId}`);
    });
  }

  async function handleActivateRoutingVersion(versionId: string) {
    await runMutation(async () => {
      const nextOverview = await controller.activateRoutingPolicyVersionAndReload({
        actorRole,
        versionId,
        reason: "Activated in Admin Governance Console.",
      });

      onOverviewChange(nextOverview, `Activated routing policy version: ${versionId}`);
    });
  }

  async function handleRollbackRoutingPolicy(policyId: string) {
    await runMutation(async () => {
      const nextOverview = await controller.rollbackRoutingPolicyAndReload({
        actorRole,
        policyId,
        reason: "Rollback initiated from Admin Governance Console.",
      });

      onOverviewChange(nextOverview, `Rolled back routing policy: ${policyId}`);
    });
  }

  const eligiblePromptTemplates = getEligiblePromptTemplates(
    overview,
    bindingForm.module,
    bindingForm.templateFamilyId,
  );
  const eligibleSkillPackages = getEligibleSkillPackages(overview, bindingForm.module);
  const eligibleVerificationCheckProfiles = getEligibleVerificationCheckProfiles(overview);
  const eligibleEvaluationSuites = getEligibleEvaluationSuites(
    overview,
    bindingForm.module,
  );
  const eligibleReleaseCheckProfiles = getEligibleReleaseCheckProfiles(
    overview,
    bindingForm.verificationCheckProfileIds,
  );
  const eligibleExecutionProfiles = getEligibleExecutionProfiles(
    overview,
    bindingForm.module,
    bindingForm.templateFamilyId,
  );

  return (
    <>
      <article className="admin-governance-panel admin-governance-panel-wide">
        <h3>Routing Policy Draft</h3>
        {overview.modelRegistryEntries.length > 0 ? (
          <>
            <div className="admin-governance-form-grid">
              <label className="admin-governance-field">
                <span>Scope Kind</span>
                <select
                  value={routingDraftForm.scopeKind}
                  onChange={(event) =>
                    setRoutingDraftForm((current) => ({
                      ...current,
                      scopeKind: event.target.value as ModelRoutingPolicyScopeKind,
                      scopeValue:
                        event.target.value === "module"
                          ? current.scopeValue || "editing"
                          : current.scopeValue ||
                            overview.selectedTemplateFamilyId ||
                            overview.templateFamilies[0]?.id ||
                            "",
                    }))
                  }
                  disabled={isMutating}
                >
                  <option value="template_family">template_family</option>
                  <option value="module">module</option>
                </select>
              </label>
              <label className="admin-governance-field">
                <span>Scope Value</span>
                {routingDraftForm.scopeKind === "module" ? (
                  <select
                    value={routingDraftForm.scopeValue}
                    onChange={(event) =>
                      setRoutingDraftForm((current) => ({
                        ...current,
                        scopeValue: event.target.value,
                      }))
                    }
                    disabled={isMutating}
                  >
                    {templateModules.map((module) => (
                      <option key={module} value={module}>
                        {module}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={routingDraftForm.scopeValue}
                    onChange={(event) =>
                      setRoutingDraftForm((current) => ({
                        ...current,
                        scopeValue: event.target.value,
                      }))
                    }
                    disabled={isMutating}
                  >
                    <option value="">Select family</option>
                    {overview.templateFamilies.map((family) => (
                      <option key={family.id} value={family.id}>
                        {family.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <label className="admin-governance-field">
                <span>Primary Model</span>
                <select
                  value={routingDraftForm.primaryModelId}
                  onChange={(event) =>
                    setRoutingDraftForm((current) => ({
                      ...current,
                      primaryModelId: event.target.value,
                    }))
                  }
                  disabled={isMutating}
                >
                  <option value="">Select model</option>
                  {overview.modelRegistryEntries.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.provider} / {model.model_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-governance-field admin-governance-field-full">
                <span>Evidence References</span>
                <input
                  type="text"
                  value={routingDraftForm.evidenceLinksText}
                  onChange={(event) =>
                    setRoutingDraftForm((current) => ({
                      ...current,
                      evidenceLinksText: event.target.value,
                    }))
                  }
                  disabled={isMutating}
                  placeholder="evaluation_run:run-1, evidence_pack:pack-1"
                />
              </label>
              <label className="admin-governance-field admin-governance-field-full">
                <span>Notes</span>
                <textarea
                  rows={3}
                  value={routingDraftForm.notes}
                  onChange={(event) =>
                    setRoutingDraftForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  disabled={isMutating}
                />
              </label>
            </div>

            <fieldset className="admin-governance-module-selector">
              <legend>Fallback Models</legend>
              <div className="admin-governance-module-options">
                {overview.modelRegistryEntries.map((model) => (
                  <label key={model.id} className="admin-governance-module-option">
                    <input
                      type="checkbox"
                      checked={routingDraftForm.fallbackModelIds.includes(model.id)}
                      onChange={() =>
                        setRoutingDraftForm((current) => ({
                          ...current,
                          fallbackModelIds: toggleSelection(
                            current.fallbackModelIds,
                            model.id,
                          ),
                        }))
                      }
                      disabled={isMutating || routingDraftForm.primaryModelId === model.id}
                    />
                    <span>{model.model_name}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="auth-actions">
              <button
                type="button"
                className="auth-primary-action"
                onClick={() => void handleCreateRoutingPolicyDraft()}
                disabled={
                  isMutating ||
                  routingDraftForm.scopeValue.trim().length === 0 ||
                  routingDraftForm.primaryModelId.length === 0
                }
              >
                Create Routing Policy Draft
              </button>
            </div>
          </>
        ) : (
          <p className="admin-governance-empty">
            Create production-approved model entries first. Routing governance drafts cite model
            registry assets rather than duplicating model metadata.
          </p>
        )}
      </article>

      <article className="admin-governance-panel admin-governance-panel-wide">
        <h3>Governed Routing Policies</h3>
        {(["template_family", "module"] as const).map((scopeKind) => {
          const policies = overview.routingPolicies.filter(
            (policy) => policy.scope_kind === scopeKind,
          );

          return (
            <section key={scopeKind} className="admin-governance-panel admin-governance-panel-tight">
              <h4>{scopeKind}</h4>
              {policies.length > 0 ? (
                <ul className="admin-governance-list admin-governance-list-spaced">
                  {policies.map((policy) => {
                    const latestVersion = getLatestRoutingPolicyVersion(policy);
                    const editor = latestVersion
                      ? routingDraftEditors[latestVersion.id] ??
                        buildRoutingDraftEditorState(latestVersion)
                      : undefined;

                    return (
                      <li key={policy.policy_id} className="admin-governance-template-row">
                        <div>
                          <strong>
                            {formatRoutingPolicyScopeKindLabel(policy.scope_kind)}
                          </strong>
                          <p>
                            <code>{policy.scope_kind}</code> / {policy.scope_value}
                          </p>
                          {policy.active_version ? (
                            <p>
                              Active Policy: {policy.active_version.primary_model_id} / fallback{" "}
                              {policy.active_version.fallback_model_ids.join(", ") || "none"}
                            </p>
                          ) : (
                            <p>No active version. Legacy fallback path remains in effect.</p>
                          )}
                          {latestVersion ? (
                            <>
                              <p>
                                Version {latestVersion.version_no} / status {latestVersion.status}
                              </p>
                              <div className="admin-governance-module-options">
                                {latestVersion.evidence_links.map((link) => (
                                  <span
                                    key={`${latestVersion.id}-${link.kind}-${link.id}`}
                                    className="admin-governance-badge"
                                  >
                                    {link.kind}:{link.id}
                                  </span>
                                ))}
                              </div>
                            </>
                          ) : null}
                        </div>

                        <div className="admin-governance-template-actions">
                          <button
                            type="button"
                            className="workbench-secondary-action"
                            onClick={() => void handleCreateRoutingPolicyVersion(policy.policy_id)}
                            disabled={isMutating || latestVersion == null}
                          >
                            New Draft Version
                          </button>
                          <button
                            type="button"
                            className="workbench-secondary-action"
                            onClick={() =>
                              latestVersion
                                ? void handleSaveRoutingDraft(latestVersion.id)
                                : undefined
                            }
                            disabled={isMutating || latestVersion?.status !== "draft"}
                          >
                            Save Draft
                          </button>
                          <button
                            type="button"
                            className="workbench-secondary-action"
                            onClick={() =>
                              latestVersion
                                ? void handleSubmitRoutingDraft(latestVersion.id)
                                : undefined
                            }
                            disabled={isMutating || latestVersion?.status !== "draft"}
                          >
                            Submit For Review
                          </button>
                          <button
                            type="button"
                            className="workbench-secondary-action"
                            onClick={() =>
                              latestVersion
                                ? void handleApproveRoutingVersion(latestVersion.id)
                                : undefined
                            }
                            disabled={isMutating || latestVersion?.status !== "pending_review"}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="workbench-secondary-action"
                            onClick={() =>
                              latestVersion
                                ? void handleActivateRoutingVersion(latestVersion.id)
                                : undefined
                            }
                            disabled={isMutating || latestVersion?.status !== "approved"}
                          >
                            Activate
                          </button>
                          <button
                            type="button"
                            className="workbench-secondary-action"
                            onClick={() => void handleRollbackRoutingPolicy(policy.policy_id)}
                            disabled={isMutating || policy.active_version == null}
                          >
                            Rollback
                          </button>
                        </div>

                        {latestVersion && editor ? (
                          <div className="admin-governance-form-grid">
                            <label className="admin-governance-field">
                              <span>Primary Model</span>
                              <select
                                value={editor.primaryModelId}
                                onChange={(event) =>
                                  setRoutingDraftEditors((current) => ({
                                    ...current,
                                    [latestVersion.id]: {
                                      ...editor,
                                      primaryModelId: event.target.value,
                                    },
                                  }))
                                }
                                disabled={isMutating || latestVersion.status !== "draft"}
                              >
                                {overview.modelRegistryEntries.map((model) => (
                                  <option key={model.id} value={model.id}>
                                    {model.provider} / {model.model_name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="admin-governance-field admin-governance-field-full">
                              <span>Evidence References</span>
                              <input
                                type="text"
                                value={editor.evidenceLinksText}
                                onChange={(event) =>
                                  setRoutingDraftEditors((current) => ({
                                    ...current,
                                    [latestVersion.id]: {
                                      ...editor,
                                      evidenceLinksText: event.target.value,
                                    },
                                  }))
                                }
                                disabled={isMutating || latestVersion.status !== "draft"}
                              />
                            </label>
                            <label className="admin-governance-field admin-governance-field-full">
                              <span>Notes</span>
                              <textarea
                                rows={2}
                                value={editor.notes}
                                onChange={(event) =>
                                  setRoutingDraftEditors((current) => ({
                                    ...current,
                                    [latestVersion.id]: {
                                      ...editor,
                                      notes: event.target.value,
                                    },
                                  }))
                                }
                                disabled={isMutating || latestVersion.status !== "draft"}
                              />
                            </label>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="admin-governance-empty">
                  No {scopeKind} routing policies yet.
                </p>
              )}
            </section>
          );
        })}
      </article>

      <article className="admin-governance-panel">
        <h3>Tool Gateway Registry</h3>
        <div className="admin-governance-form-grid">
          <label className="admin-governance-field">
            <span>Tool Name</span>
            <input
              type="text"
              value={toolForm.name}
              onChange={(event) =>
                setToolForm((current) => ({ ...current, name: event.target.value }))
              }
              disabled={isMutating}
            />
          </label>
          <label className="admin-governance-field">
            <span>Scope</span>
            <select
              value={toolForm.scope}
              onChange={(event) =>
                setToolForm((current) => ({
                  ...current,
                  scope: event.target.value as ToolGatewayScope,
                }))
              }
              disabled={isMutating}
            >
              {toolGatewayScopes.map((scope) => (
                <option key={scope} value={scope}>
                  {scope}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-governance-field">
            <span>Access Mode</span>
            <select
              value={toolForm.accessMode}
              onChange={(event) =>
                setToolForm((current) => ({
                  ...current,
                  accessMode: event.target.value as ToolGatewayAccessMode,
                }))
              }
              disabled={isMutating}
            >
              {toolAccessModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="auth-actions">
          <button
            type="button"
            className="auth-primary-action"
            onClick={() => void handleCreateTool()}
            disabled={isMutating || toolForm.name.trim().length === 0}
          >
            Create Tool Entry
          </button>
        </div>

        {overview.toolGatewayTools.length > 0 ? (
          <ul className="admin-governance-list">
            {overview.toolGatewayTools.map((tool) => (
              <li key={tool.id} className="admin-governance-asset-row">
                <span>{tool.name}</span>
                <small>
                  {tool.scope} / {tool.access_mode}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-governance-empty">
            No tools registered yet. Create at least one tool so sandbox and policy profiles can
            reference it.
          </p>
        )}
      </article>

      <article className="admin-governance-panel">
        <h3>Sandbox Profiles</h3>
        <div className="admin-governance-form-grid">
          <label className="admin-governance-field">
            <span>Profile Name</span>
            <input
              type="text"
              value={sandboxForm.name}
              onChange={(event) =>
                setSandboxForm((current) => ({ ...current, name: event.target.value }))
              }
              disabled={isMutating}
            />
          </label>
          <label className="admin-governance-field">
            <span>Sandbox Mode</span>
            <select
              value={sandboxForm.sandboxMode}
              onChange={(event) =>
                setSandboxForm((current) => ({
                  ...current,
                  sandboxMode: event.target.value as SandboxMode,
                }))
              }
              disabled={isMutating}
            >
              {sandboxModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-governance-field">
            <span>Network Access</span>
            <select
              value={sandboxForm.networkAccess ? "yes" : "no"}
              onChange={(event) =>
                setSandboxForm((current) => ({
                  ...current,
                  networkAccess: event.target.value === "yes",
                }))
              }
              disabled={isMutating}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="admin-governance-field">
            <span>Approval Required</span>
            <select
              value={sandboxForm.approvalRequired ? "yes" : "no"}
              onChange={(event) =>
                setSandboxForm((current) => ({
                  ...current,
                  approvalRequired: event.target.value === "yes",
                }))
              }
              disabled={isMutating}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>

        <fieldset className="admin-governance-module-selector">
          <legend>Allowed Tools</legend>
          <div className="admin-governance-module-options">
            {overview.toolGatewayTools.map((tool) => (
              <label key={tool.id} className="admin-governance-module-option">
                <input
                  type="checkbox"
                  checked={sandboxForm.allowedToolIds.includes(tool.id)}
                  onChange={() =>
                    setSandboxForm((current) => ({
                      ...current,
                      allowedToolIds: toggleSelection(current.allowedToolIds, tool.id),
                    }))
                  }
                  disabled={isMutating}
                />
                <span>{tool.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="auth-actions">
          <button
            type="button"
            className="auth-primary-action"
            onClick={() => void handleCreateSandboxProfile()}
            disabled={isMutating || sandboxForm.name.trim().length === 0}
          >
            Create Sandbox Profile
          </button>
        </div>

        {overview.sandboxProfiles.length > 0 ? (
          <ul className="admin-governance-list admin-governance-list-spaced">
            {overview.sandboxProfiles.map((profile) => (
              <li key={profile.id} className="admin-governance-template-row">
                <div>
                  <strong>{profile.name}</strong>
                  <p>
                    {profile.sandbox_mode} / network {profile.network_access ? "on" : "off"} /
                    approval {profile.approval_required ? "required" : "not_required"}
                  </p>
                </div>
                <div className="admin-governance-template-actions">
                  <span className="admin-governance-badge">{profile.status}</span>
                  {profile.status === "draft" ? (
                    <button
                      type="button"
                      className="workbench-secondary-action"
                      onClick={() => void handleActivateSandboxProfile(profile.id)}
                      disabled={isMutating}
                    >
                      Activate
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-governance-empty">
            No sandbox profiles yet. These gate filesystem, network, and approval behavior for
            governed agents.
          </p>
        )}
      </article>

      <article className="admin-governance-panel">
        <h3>Agent Profiles</h3>
        <div className="admin-governance-form-grid">
          <label className="admin-governance-field">
            <span>Profile Name</span>
            <input
              type="text"
              value={agentProfileForm.name}
              onChange={(event) =>
                setAgentProfileForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              disabled={isMutating}
            />
          </label>
          <label className="admin-governance-field">
            <span>Role Key</span>
            <select
              value={agentProfileForm.roleKey}
              onChange={(event) =>
                setAgentProfileForm((current) => ({
                  ...current,
                  roleKey: event.target.value as AgentProfileRoleKey,
                }))
              }
              disabled={isMutating}
            >
              {agentProfileRoleKeys.map((roleKey) => (
                <option key={roleKey} value={roleKey}>
                  {roleKey}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-governance-field">
            <span>Module Scope</span>
            <select
              value={agentProfileForm.moduleScopeMode}
              onChange={(event) =>
                setAgentProfileForm((current) => ({
                  ...current,
                  moduleScopeMode: event.target.value as "any" | "selected",
                }))
              }
              disabled={isMutating}
            >
              <option value="selected">Selected Modules</option>
              <option value="any">Any Module</option>
            </select>
          </label>
          <label className="admin-governance-field">
            <span>Manuscript Types</span>
            <select
              value={agentProfileForm.manuscriptTypeMode}
              onChange={(event) =>
                setAgentProfileForm((current) => ({
                  ...current,
                  manuscriptTypeMode: event.target.value as "any" | "selected",
                }))
              }
              disabled={isMutating}
            >
              <option value="selected">Selected Types</option>
              <option value="any">Any Type</option>
            </select>
          </label>
          <label className="admin-governance-field admin-governance-field-full">
            <span>Description</span>
            <textarea
              rows={3}
              value={agentProfileForm.description}
              onChange={(event) =>
                setAgentProfileForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              disabled={isMutating}
            />
          </label>
        </div>

        {agentProfileForm.moduleScopeMode === "selected" ? (
          <fieldset className="admin-governance-module-selector">
            <legend>Module Scope</legend>
            <div className="admin-governance-module-options">
              {templateModules.map((module) => (
                <label key={module} className="admin-governance-module-option">
                  <input
                    type="checkbox"
                    checked={agentProfileForm.moduleScope.includes(module)}
                    onChange={() =>
                      setAgentProfileForm((current) => ({
                        ...current,
                        moduleScope: toggleSelection(current.moduleScope, module),
                      }))
                    }
                    disabled={isMutating}
                  />
                  <span>{module}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {agentProfileForm.manuscriptTypeMode === "selected" ? (
          <fieldset className="admin-governance-module-selector">
            <legend>Manuscript Types</legend>
            <div className="admin-governance-module-options">
              {manuscriptTypes.map((manuscriptType) => (
                <label key={manuscriptType} className="admin-governance-module-option">
                  <input
                    type="checkbox"
                    checked={agentProfileForm.manuscriptTypes.includes(manuscriptType)}
                    onChange={() =>
                      setAgentProfileForm((current) => ({
                        ...current,
                        manuscriptTypes: toggleSelection(
                          current.manuscriptTypes,
                          manuscriptType,
                        ),
                      }))
                    }
                    disabled={isMutating}
                  />
                  <span>{manuscriptType}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="auth-actions">
          <button
            type="button"
            className="auth-primary-action"
            onClick={() => void handleCreateAgentProfile()}
            disabled={
              isMutating ||
              agentProfileForm.name.trim().length === 0 ||
              (agentProfileForm.moduleScopeMode === "selected" &&
                agentProfileForm.moduleScope.length === 0) ||
              (agentProfileForm.manuscriptTypeMode === "selected" &&
                agentProfileForm.manuscriptTypes.length === 0)
            }
          >
            Create Agent Profile
          </button>
        </div>

        {overview.agentProfiles.length > 0 ? (
          <ul className="admin-governance-list admin-governance-list-spaced">
            {overview.agentProfiles.map((profile) => (
              <li key={profile.id} className="admin-governance-template-row">
                <div>
                  <strong>{profile.name}</strong>
                  <p>
                    {profile.role_key} / modules{" "}
                    {Array.isArray(profile.module_scope)
                      ? profile.module_scope.join(", ")
                      : profile.module_scope}{" "}
                    / types{" "}
                    {Array.isArray(profile.manuscript_types)
                      ? profile.manuscript_types.join(", ")
                      : profile.manuscript_types}
                  </p>
                </div>
                <div className="admin-governance-template-actions">
                  <span className="admin-governance-badge">{profile.status}</span>
                  {profile.status === "draft" ? (
                    <button
                      type="button"
                      className="workbench-secondary-action"
                      onClick={() => void handlePublishAgentProfile(profile.id)}
                      disabled={isMutating}
                    >
                      Publish
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-governance-empty">
            No agent profiles yet. These encode the governed gstack / superpowers / subagent role
            contracts the runtime can bind.
          </p>
        )}
      </article>

      <article className="admin-governance-panel">
        <h3>Agent Runtimes</h3>
        <div className="admin-governance-form-grid">
          <label className="admin-governance-field">
            <span>Runtime Name</span>
            <input
              type="text"
              value={runtimeForm.name}
              onChange={(event) =>
                setRuntimeForm((current) => ({ ...current, name: event.target.value }))
              }
              disabled={isMutating}
            />
          </label>
          <label className="admin-governance-field">
            <span>Adapter</span>
            <select
              value={runtimeForm.adapter}
              onChange={(event) =>
                setRuntimeForm((current) => ({
                  ...current,
                  adapter: event.target.value as AgentRuntimeAdapter,
                }))
              }
              disabled={isMutating}
            >
              {agentRuntimeAdapters.map((adapter) => (
                <option key={adapter} value={adapter}>
                  {adapter}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-governance-field">
            <span>Sandbox Profile</span>
            <select
              value={runtimeForm.sandboxProfileId}
              onChange={(event) =>
                setRuntimeForm((current) => ({
                  ...current,
                  sandboxProfileId: event.target.value,
                }))
              }
              disabled={isMutating}
            >
              <option value="">Unassigned</option>
              {overview.sandboxProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-governance-field">
            <span>Runtime Slot</span>
            <input
              type="text"
              value={runtimeForm.runtimeSlot}
              onChange={(event) =>
                setRuntimeForm((current) => ({ ...current, runtimeSlot: event.target.value }))
              }
              disabled={isMutating}
            />
          </label>
        </div>

        <fieldset className="admin-governance-module-selector">
          <legend>Allowed Modules</legend>
          <div className="admin-governance-module-options">
            {templateModules.map((module) => (
              <label key={module} className="admin-governance-module-option">
                <input
                  type="checkbox"
                  checked={runtimeForm.allowedModules.includes(module)}
                  onChange={() =>
                    setRuntimeForm((current) => ({
                      ...current,
                      allowedModules: toggleSelection(current.allowedModules, module),
                    }))
                  }
                  disabled={isMutating}
                />
                <span>{module}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="auth-actions">
          <button
            type="button"
            className="auth-primary-action"
            onClick={() => void handleCreateRuntime()}
            disabled={
              isMutating ||
              runtimeForm.name.trim().length === 0 ||
              runtimeForm.allowedModules.length === 0
            }
          >
            Create Runtime
          </button>
        </div>

        {overview.agentRuntimes.length > 0 ? (
          <ul className="admin-governance-list admin-governance-list-spaced">
            {overview.agentRuntimes.map((runtime) => (
              <li key={runtime.id} className="admin-governance-template-row">
                <div>
                  <strong>{runtime.name}</strong>
                  <p>
                    {runtime.adapter} / slot {runtime.runtime_slot ?? "unassigned"} / sandbox{" "}
                    {runtime.sandbox_profile_id ?? "none"}
                  </p>
                </div>
                <div className="admin-governance-template-actions">
                  <span className="admin-governance-badge">{runtime.status}</span>
                  {runtime.status === "draft" ? (
                    <button
                      type="button"
                      className="workbench-secondary-action"
                      onClick={() => void handlePublishRuntime(runtime.id)}
                      disabled={isMutating}
                    >
                      Publish
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-governance-empty">
            No agent runtimes yet. Published runtimes become candidates for governed runtime
            bindings.
          </p>
        )}
      </article>

      <article className="admin-governance-panel admin-governance-panel-wide">
        <h3>Tool Permission Policies</h3>
        <div className="admin-governance-form-grid">
          <label className="admin-governance-field">
            <span>Policy Name</span>
            <input
              type="text"
              value={policyForm.name}
              onChange={(event) =>
                setPolicyForm((current) => ({ ...current, name: event.target.value }))
              }
              disabled={isMutating}
            />
          </label>
          <label className="admin-governance-field">
            <span>Default Mode</span>
            <select
              value={policyForm.defaultMode}
              onChange={(event) =>
                setPolicyForm((current) => ({
                  ...current,
                  defaultMode: event.target.value as ToolGatewayAccessMode,
                }))
              }
              disabled={isMutating}
            >
              {toolAccessModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-governance-field">
            <span>Write Requires Confirmation</span>
            <select
              value={policyForm.writeRequiresConfirmation ? "yes" : "no"}
              onChange={(event) =>
                setPolicyForm((current) => ({
                  ...current,
                  writeRequiresConfirmation: event.target.value === "yes",
                }))
              }
              disabled={isMutating}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>

        <fieldset className="admin-governance-module-selector">
          <legend>Allowed Tools</legend>
          <div className="admin-governance-module-options">
            {overview.toolGatewayTools.map((tool) => (
              <label key={tool.id} className="admin-governance-module-option">
                <input
                  type="checkbox"
                  checked={policyForm.allowedToolIds.includes(tool.id)}
                  onChange={() =>
                    setPolicyForm((current) => ({
                      ...current,
                      allowedToolIds: toggleSelection(current.allowedToolIds, tool.id),
                    }))
                  }
                  disabled={isMutating}
                />
                <span>{tool.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="admin-governance-module-selector">
          <legend>High-Risk Tools</legend>
          <div className="admin-governance-module-options">
            {overview.toolGatewayTools.map((tool) => (
              <label key={tool.id} className="admin-governance-module-option">
                <input
                  type="checkbox"
                  checked={policyForm.highRiskToolIds.includes(tool.id)}
                  onChange={() =>
                    setPolicyForm((current) => ({
                      ...current,
                      highRiskToolIds: toggleSelection(current.highRiskToolIds, tool.id),
                    }))
                  }
                  disabled={isMutating}
                />
                <span>{tool.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="auth-actions">
          <button
            type="button"
            className="auth-primary-action"
            onClick={() => void handleCreateToolPermissionPolicy()}
            disabled={isMutating || policyForm.name.trim().length === 0}
          >
            Create Tool Policy
          </button>
        </div>

        {overview.toolPermissionPolicies.length > 0 ? (
          <ul className="admin-governance-list admin-governance-list-spaced">
            {overview.toolPermissionPolicies.map((policy) => (
              <li key={policy.id} className="admin-governance-template-row">
                <div>
                  <strong>{policy.name}</strong>
                  <p>
                    default {policy.default_mode} / allowed {policy.allowed_tool_ids.length} /
                    high-risk {policy.high_risk_tool_ids?.length ?? 0}
                  </p>
                </div>
                <div className="admin-governance-template-actions">
                  <span className="admin-governance-badge">{policy.status}</span>
                  {policy.status === "draft" ? (
                    <button
                      type="button"
                      className="workbench-secondary-action"
                      onClick={() => void handleActivateToolPermissionPolicy(policy.id)}
                      disabled={isMutating}
                    >
                      Activate
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-governance-empty">
            No tool policies yet. Use these to restrict read/write actions before binding live
            runtimes.
          </p>
        )}
      </article>

      <article className="admin-governance-panel admin-governance-panel-wide">
        <h3>Runtime Bindings</h3>
        <div className="admin-governance-form-grid">
          <label className="admin-governance-field">
            <span>Template Family</span>
            <select
              value={bindingForm.templateFamilyId}
              onChange={(event) =>
                setBindingForm((current) => ({
                  ...current,
                  templateFamilyId: event.target.value,
                }))
              }
              disabled={isMutating}
            >
              <option value="">Select family</option>
              {overview.templateFamilies.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-governance-field">
            <span>Module</span>
            <select
              value={bindingForm.module}
              onChange={(event) =>
                setBindingForm((current) => ({
                  ...current,
                  module: event.target.value as TemplateModule,
                }))
              }
              disabled={isMutating}
            >
              {templateModules.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-governance-field">
            <span>Runtime</span>
            <select
              value={bindingForm.runtimeId}
              onChange={(event) =>
                setBindingForm((current) => ({ ...current, runtimeId: event.target.value }))
              }
              disabled={isMutating}
            >
              <option value="">Select runtime</option>
              {overview.agentRuntimes.map((runtime) => (
                <option key={runtime.id} value={runtime.id}>
                  {runtime.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-governance-field">
            <span>Sandbox</span>
            <select
              value={bindingForm.sandboxProfileId}
              onChange={(event) =>
                setBindingForm((current) => ({
                  ...current,
                  sandboxProfileId: event.target.value,
                }))
              }
              disabled={isMutating}
            >
              <option value="">Select sandbox</option>
              {overview.sandboxProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-governance-field">
            <span>Agent Profile</span>
            <select
              value={bindingForm.agentProfileId}
              onChange={(event) =>
                setBindingForm((current) => ({
                  ...current,
                  agentProfileId: event.target.value,
                }))
              }
              disabled={isMutating}
            >
              <option value="">Select agent profile</option>
              {overview.agentProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-governance-field">
            <span>Tool Policy</span>
            <select
              value={bindingForm.toolPermissionPolicyId}
              onChange={(event) =>
                setBindingForm((current) => ({
                  ...current,
                  toolPermissionPolicyId: event.target.value,
                }))
              }
              disabled={isMutating}
            >
              <option value="">Select policy</option>
              {overview.toolPermissionPolicies.map((policy) => (
                <option key={policy.id} value={policy.id}>
                  {policy.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-governance-field">
            <span>Prompt Template</span>
            <select
              value={bindingForm.promptTemplateId}
              onChange={(event) =>
                setBindingForm((current) => ({
                  ...current,
                  promptTemplateId: event.target.value,
                }))
              }
              disabled={isMutating}
            >
              <option value="">Select prompt</option>
              {eligiblePromptTemplates.map((promptTemplate) => (
                <option key={promptTemplate.id} value={promptTemplate.id}>
                  {promptTemplate.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-governance-field">
            <span>Execution Profile</span>
            <select
              value={bindingForm.executionProfileId}
              onChange={(event) =>
                setBindingForm((current) => ({
                  ...current,
                  executionProfileId: event.target.value,
                }))
              }
              disabled={isMutating}
            >
              <option value="">Optional</option>
              {eligibleExecutionProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.module} / {profile.template_family_id} / v{profile.version}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-governance-field">
            <span>Release Check Profile</span>
            <select
              value={bindingForm.releaseCheckProfileId}
              onChange={(event) =>
                setBindingForm((current) => ({
                  ...current,
                  releaseCheckProfileId: event.target.value,
                }))
              }
              disabled={isMutating}
            >
              <option value="">Optional</option>
              {eligibleReleaseCheckProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="admin-governance-module-selector">
          <legend>Skill Packages</legend>
          <div className="admin-governance-module-options">
            {eligibleSkillPackages.map((skillPackage) => (
              <label key={skillPackage.id} className="admin-governance-module-option">
                <input
                  type="checkbox"
                  checked={bindingForm.skillPackageIds.includes(skillPackage.id)}
                  onChange={() =>
                    setBindingForm((current) => ({
                      ...current,
                      skillPackageIds: toggleSelection(current.skillPackageIds, skillPackage.id),
                    }))
                  }
                  disabled={isMutating}
                />
                <span>{skillPackage.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <RuntimeBindingQualityPackageEditor
          availablePackages={getEligibleQualityPackages(overview)}
          selectedVersionIds={bindingForm.qualityPackageVersionIds}
          onChange={(qualityPackageVersionIds) =>
            setBindingForm((current) => ({
              ...current,
              qualityPackageVersionIds,
            }))
          }
          isMutating={isMutating}
          legend="Quality Packages"
          emptyMessage="Publish a quality package to bind it into a runtime."
        />
        <fieldset className="admin-governance-module-selector">
          <legend>Verification Check Profiles</legend>
          <div className="admin-governance-module-options">
            {eligibleVerificationCheckProfiles.map((profile) => (
              <label key={profile.id} className="admin-governance-module-option">
                <input
                  type="checkbox"
                  checked={bindingForm.verificationCheckProfileIds.includes(profile.id)}
                  onChange={() =>
                    setBindingForm((current) => ({
                      ...current,
                      verificationCheckProfileIds: toggleSelection(
                        current.verificationCheckProfileIds,
                        profile.id,
                      ),
                    }))
                  }
                  disabled={isMutating}
                />
                <span>{profile.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="admin-governance-module-selector">
          <legend>Evaluation Suites</legend>
          <div className="admin-governance-module-options">
            {eligibleEvaluationSuites.map((suite) => (
              <label key={suite.id} className="admin-governance-module-option">
                <input
                  type="checkbox"
                  checked={bindingForm.evaluationSuiteIds.includes(suite.id)}
                  onChange={() =>
                    setBindingForm((current) => ({
                      ...current,
                      evaluationSuiteIds: toggleSelection(
                        current.evaluationSuiteIds,
                        suite.id,
                      ),
                    }))
                  }
                  disabled={isMutating}
                />
                <span>{suite.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="auth-actions">
          <button
            type="button"
            className="auth-primary-action"
            onClick={() => void handleCreateRuntimeBinding()}
            disabled={
              isMutating ||
              bindingForm.templateFamilyId.length === 0 ||
              bindingForm.runtimeId.length === 0 ||
              bindingForm.sandboxProfileId.length === 0 ||
              bindingForm.agentProfileId.length === 0 ||
              bindingForm.toolPermissionPolicyId.length === 0 ||
              bindingForm.promptTemplateId.length === 0
            }
          >
            Create Runtime Binding
          </button>
        </div>

        {overview.runtimeBindings.length > 0 ? (
          <ul className="admin-governance-list admin-governance-list-spaced">
            {overview.runtimeBindings.map((binding) => (
              <li key={binding.id} className="admin-governance-template-row">
                <div>
                  <strong>
                    {binding.module} / {binding.template_family_id}
                  </strong>
                  <p>
                    runtime {binding.runtime_id} / sandbox {binding.sandbox_profile_id} / agent{" "}
                    {binding.agent_profile_id}
                  </p>
                  <p>
                    checks{" "}
                    {formatIdList(
                      resolveNamedItems(
                        binding.verification_check_profile_ids,
                        overview.verificationCheckProfiles,
                      ),
                    )}{" "}
                    / suites{" "}
                    {formatIdList(
                      resolveNamedItems(
                        binding.evaluation_suite_ids,
                        overview.evaluationSuites,
                      ),
                    )}{" "}
                    / release{" "}
                    {resolveNamedItem(
                      binding.release_check_profile_id,
                      overview.releaseCheckProfiles,
                    ) ?? "none"}
                  </p>
                  <p>
                    quality packages{" "}
                    {formatIdList(
                      resolveQualityPackageVersionLabels(
                        binding.quality_package_version_ids ?? [],
                        overview.qualityPackages,
                      ),
                    )}
                  </p>
                </div>
                <div className="admin-governance-template-actions">
                  <span className="admin-governance-badge">{binding.status}</span>
                  <small>v{binding.version}</small>
                  {binding.status === "draft" ? (
                    <button
                      type="button"
                      className="workbench-secondary-action"
                      onClick={() => void handleActivateRuntimeBinding(binding.id)}
                      disabled={isMutating}
                    >
                      Activate
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-governance-empty">
            No runtime bindings yet. A binding turns the selected runtime, tool policy, prompt, and
            execution profile into a live governed bundle.
          </p>
        )}
      </article>

      <article className="admin-governance-panel admin-governance-panel-wide">
        <h3>Recent Agent Executions</h3>
        <div className="admin-governance-toolbar">
          <div
            className="admin-governance-filter-row"
            role="group"
            aria-label="Execution status filters"
          >
            {executionStatusFilters.map((statusFilter) => (
              <button
                key={statusFilter}
                type="button"
                className={`workbench-secondary-action admin-governance-filter-button${executionStatusFilter === statusFilter ? " is-selected" : ""}`}
                onClick={() => setExecutionStatusFilter(statusFilter)}
                aria-pressed={executionStatusFilter === statusFilter}
              >
                {formatExecutionStatusFilterLabel(statusFilter, executionStatusCounts[statusFilter])}
              </button>
            ))}
          </div>
          <label className="admin-governance-field">
            <span>Search executions</span>
            <input
              type="search"
              value={executionSearchValue}
              onChange={(event) => setExecutionSearchValue(event.target.value)}
              placeholder="Search manuscript, log, runtime, binding, or actor"
            />
          </label>
        </div>

        {selectedExecutionIsHidden ? (
          <div className="admin-governance-inline-notice" role="status">
            <p>Selected execution is hidden by the current filters.</p>
            <button
              type="button"
              className="workbench-secondary-action"
              onClick={() => {
                setExecutionStatusFilter("all");
                setExecutionSearchValue("");
              }}
            >
              Show selected execution
            </button>
          </div>
        ) : null}

        {overview.agentExecutionLogs.length > 0 ? (
          visibleExecutionLogs.length > 0 ? (
            <ul className="admin-governance-list admin-governance-list-spaced">
              {visibleExecutionLogs.map((log) => (
              <li key={log.id} className="admin-governance-template-row">
                <div>
                  <strong>
                    {log.module} / manuscript {log.manuscript_id}
                  </strong>
                  <p>
                    runtime {log.runtime_id} / binding {log.runtime_binding_id} / triggered by{" "}
                    {log.triggered_by}
                  </p>
                </div>
                <div className="admin-governance-template-actions">
                  <span className="admin-governance-badge">{log.status}</span>
                  <small>{log.started_at}</small>
                  <button
                    type="button"
                    className="workbench-secondary-action"
                    onClick={() => setSelectedExecutionLogId(log.id)}
                    disabled={isExecutionEvidenceLoading && selectedExecutionLogId === log.id}
                  >
                    {selectedExecutionLogId === log.id
                      ? isExecutionEvidenceLoading
                        ? "Inspecting"
                        : "Selected"
                      : "Inspect"}
                  </button>
                </div>
              </li>
              ))}
            </ul>
          ) : (
            <div className="admin-governance-inline-notice" role="status">
              <p>No executions match the current filters.</p>
              {hasExecutionFilters ? (
                <button
                  type="button"
                  className="workbench-secondary-action"
                  onClick={() => {
                    setExecutionStatusFilter("all");
                    setExecutionSearchValue("");
                  }}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          )
        ) : (
          <p className="admin-governance-empty">
            No agent execution logs yet. Recent governed runs will surface here after manuscript
            execution starts using runtime bindings.
          </p>
        )}

        {executionEvidenceError ? (
          <article className="workbench-placeholder workbench-notice" role="alert">
            <h2>Execution Evidence Unavailable</h2>
            <p>{executionEvidenceError}</p>
          </article>
        ) : null}

        {isExecutionEvidenceLoading ? (
          <article className="workbench-placeholder" role="status">
            <h2>Loading Execution Evidence</h2>
            <p>Fetching snapshot and knowledge-hit details for the selected execution log.</p>
          </article>
        ) : executionEvidence ? (
          <AgentExecutionEvidenceView evidence={executionEvidence} />
        ) : null}
      </article>
    </>
  );
}

function getEligiblePromptTemplates(
  overview: AdminGovernanceOverview,
  module: TemplateModule,
  templateFamilyId: string,
) {
  const selectedFamily = overview.templateFamilies.find((family) => family.id === templateFamilyId);
  return overview.promptTemplates.filter((promptTemplate) => {
    if (promptTemplate.module !== module) {
      return false;
    }

    return (
      promptTemplate.manuscript_types === "any" ||
      selectedFamily == null ||
      promptTemplate.manuscript_types.includes(selectedFamily.manuscript_type)
    );
  });
}

function getEligibleSkillPackages(overview: AdminGovernanceOverview, module: TemplateModule) {
  return overview.skillPackages.filter((skillPackage) =>
    skillPackage.applies_to_modules.includes(module),
  );
}

function getEligibleQualityPackages(overview: AdminGovernanceOverview) {
  return overview.qualityPackages.filter((record) => record.status === "published");
}

function getEligibleVerificationCheckProfiles(overview: AdminGovernanceOverview) {
  return overview.verificationCheckProfiles.filter(
    (profile) => profile.status === "published",
  );
}

function getEligibleEvaluationSuites(
  overview: AdminGovernanceOverview,
  module: TemplateModule,
) {
  return overview.evaluationSuites.filter(
    (suite) =>
      suite.status === "active" &&
      (suite.module_scope === "any" || suite.module_scope.includes(module)),
  );
}

function getEligibleReleaseCheckProfiles(
  overview: AdminGovernanceOverview,
  selectedCheckProfileIds: readonly string[],
) {
  const selectedChecks = new Set(selectedCheckProfileIds);
  return overview.releaseCheckProfiles.filter((profile) => {
    if (profile.status !== "published") {
      return false;
    }

    if (selectedChecks.size === 0) {
      return true;
    }

    return profile.verification_check_profile_ids.every((id) =>
      selectedChecks.has(id),
    );
  });
}

function getEligibleExecutionProfiles(
  overview: AdminGovernanceOverview,
  module: TemplateModule,
  templateFamilyId: string,
) {
  return overview.executionProfiles.filter(
    (profile) =>
      profile.module === module &&
      (templateFamilyId.length === 0 || profile.template_family_id === templateFamilyId),
  );
}

function normalizeOptionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function toggleSelection<TValue extends string>(
  currentValues: readonly TValue[],
  value: TValue,
): TValue[] {
  if (currentValues.includes(value)) {
    return currentValues.filter((currentValue) => currentValue !== value);
  }

  return [...currentValues, value];
}

function syncSingleSelection<TRecord extends { id: string }>(
  currentId: string,
  records: readonly TRecord[],
  fallbackId = "",
): string {
  if (currentId.length > 0 && records.some((record) => record.id === currentId)) {
    return currentId;
  }

  return fallbackId;
}

function syncMultiSelection<TRecord extends { id: string }>(
  currentIds: readonly string[],
  records: readonly TRecord[],
  fallbackId?: string,
): string[] {
  const validIds = currentIds.filter((currentId) =>
    records.some((record) => record.id === currentId),
  );

  if (
    validIds.length === currentIds.length &&
    validIds.every((currentId, index) => currentId === currentIds[index])
  ) {
    return currentIds as string[];
  }

  if (validIds.length > 0 || !fallbackId) {
    return validIds;
  }

  return records.some((record) => record.id === fallbackId) ? [fallbackId] : [];
}

function toExecutionEvidenceErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unable to load execution evidence.";
}

function countExecutionLogsByStatus(logs: readonly AgentExecutionLogViewModel[]) {
  return logs.reduce<Record<AgentExecutionStatusFilter, number>>(
    (counts, log) => {
      counts.all += 1;
      counts[log.status] += 1;
      return counts;
    },
    {
      all: 0,
      running: 0,
      completed: 0,
      failed: 0,
      queued: 0,
    },
  );
}

function getVisibleAgentExecutionLogs(
  logs: readonly AgentExecutionLogViewModel[],
  input: {
    statusFilter: AgentExecutionStatusFilter;
    searchValue: string;
    limit: number;
  },
) {
  const normalizedSearch = input.searchValue.trim().toLowerCase();

  return [...logs]
    .sort(compareAgentExecutionLogsForTriage)
    .filter((log) =>
      input.statusFilter === "all" ? true : log.status === input.statusFilter,
    )
    .filter((log) =>
      normalizedSearch.length === 0
        ? true
        : formatAgentExecutionSearchHaystack(log).includes(normalizedSearch),
    )
    .slice(0, input.limit);
}

function compareAgentExecutionLogsForTriage(
  left: AgentExecutionLogViewModel,
  right: AgentExecutionLogViewModel,
) {
  const leftRank = getExecutionStatusPriority(left.status);
  const rightRank = getExecutionStatusPriority(right.status);

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return Date.parse(right.started_at) - Date.parse(left.started_at);
}

function getExecutionStatusPriority(status: AgentExecutionLogViewModel["status"]) {
  switch (status) {
    case "failed":
      return 0;
    case "running":
      return 1;
    case "queued":
      return 2;
    case "completed":
      return 3;
  }
}

function formatAgentExecutionSearchHaystack(log: AgentExecutionLogViewModel) {
  return [
    log.id,
    log.manuscript_id,
    log.module,
    log.triggered_by,
    log.runtime_id,
    log.runtime_binding_id,
    log.agent_profile_id,
    log.sandbox_profile_id,
    log.tool_permission_policy_id,
    ...log.verification_check_profile_ids,
    ...log.evaluation_suite_ids,
    log.release_check_profile_id ?? "",
    log.status,
  ]
    .join(" ")
    .toLowerCase();
}

function resolveNamedItems<TRecord extends { id: string; name: string }>(
  ids: readonly string[],
  records: readonly TRecord[],
) {
  return ids.map((id) => resolveNamedItem(id, records) ?? id);
}

function resolveNamedItem<TRecord extends { id: string; name: string }>(
  id: string | undefined,
  records: readonly TRecord[],
) {
  if (!id) {
    return undefined;
  }

  return records.find((record) => record.id === id)?.name ?? id;
}

function formatIdList(values: readonly string[]) {
  return values.length > 0 ? values.join(", ") : "none";
}

function resolveQualityPackageVersionLabels(
  ids: readonly string[],
  records: readonly AdminGovernanceOverview["qualityPackages"][number][],
) {
  return ids.map((id) => {
    const record = records.find((candidate) => candidate.id === id);
    return record ? `${record.package_name} v${record.version}` : id;
  });
}

function formatExecutionStatusFilterLabel(
  statusFilter: AgentExecutionStatusFilter,
  count: number,
) {
  switch (statusFilter) {
    case "all":
      return `All (${count})`;
    case "running":
      return `Running (${count})`;
    case "completed":
      return `Completed (${count})`;
    case "failed":
      return `Failed (${count})`;
    case "queued":
      return `Queued (${count})`;
  }
}

function getLatestRoutingPolicyVersion(
  policy: AdminGovernanceOverview["routingPolicies"][number],
): ModelRoutingPolicyVersionViewModel | undefined {
  const uniqueVersions = new Map<string, ModelRoutingPolicyVersionViewModel>();

  for (const version of policy.versions) {
    uniqueVersions.set(version.id, version);
  }

  if (policy.active_version) {
    uniqueVersions.set(policy.active_version.id, policy.active_version);
  }

  return [...uniqueVersions.values()].sort((left, right) => {
    if (left.version_no !== right.version_no) {
      return right.version_no - left.version_no;
    }

    return Date.parse(right.updated_at) - Date.parse(left.updated_at);
  })[0];
}

function buildRoutingDraftEditorState(version: ModelRoutingPolicyVersionViewModel) {
  return {
    primaryModelId: version.primary_model_id,
    fallbackModelIds: [...version.fallback_model_ids],
    evidenceLinksText: version.evidence_links
      .map((link) => `${link.kind}:${link.id}`)
      .join(", "),
    notes: version.notes ?? "",
  };
}

function parseRoutingEvidenceLinks(
  input: string,
): ModelRoutingPolicyEvidenceLinkViewModel[] {
  const supportedKinds = new Set<ModelRoutingPolicyEvidenceLinkViewModel["kind"]>([
    "evaluation_suite",
    "evaluation_run",
    "evidence_pack",
    "recommendation_summary",
  ]);

  return input
    .split(/[\r\n,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .flatMap((entry) => {
      const separatorIndex = entry.indexOf(":");
      if (separatorIndex <= 0 || separatorIndex === entry.length - 1) {
        return [];
      }

      const kind = entry.slice(0, separatorIndex).trim();
      const id = entry.slice(separatorIndex + 1).trim();
      if (
        id.length === 0 ||
        !supportedKinds.has(kind as ModelRoutingPolicyEvidenceLinkViewModel["kind"])
      ) {
        return [];
      }

      return [
        {
          kind: kind as ModelRoutingPolicyEvidenceLinkViewModel["kind"],
          id,
        },
      ];
    });
}
