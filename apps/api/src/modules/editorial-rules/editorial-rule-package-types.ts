import type {
  CompiledEditorialRuleSeed,
  CreateRulePackageExampleSourceSessionInput as ContractCreateRulePackageExampleSourceSessionInput,
  EditIntentSignal,
  ExampleDocumentSnapshot,
  ExamplePairUploadInput,
  GenerateRulePackageCandidatesFromReviewedCaseInput as ContractGenerateRulePackageCandidatesFromReviewedCaseInput,
  PreviewCompileRulePackagesInput as ContractPreviewCompileRulePackagesInput,
  RulePackageCandidate,
  RulePackageCompilePublishReadiness,
  RulePackageCompilePreview,
  RulePackageCompileProjectionReadiness,
  RulePackageCompileTargetMode,
  RulePackageGenerationContext,
  RulePackageExampleSourceSession,
  RulePackagePreviewInput,
  RulePackageWorkspace,
  RulePackageWorkspaceSourceInput,
} from "@medical/contracts";
import type { RoleKey } from "../../users/roles.ts";

export interface RulePackageRecognitionInput {
  context: RulePackageGenerationContext;
  original: ExampleDocumentSnapshot;
  edited: ExampleDocumentSnapshot;
  signals: EditIntentSignal[];
}

export interface GenerateRulePackageCandidatesInput
  extends ExamplePairUploadInput {}

export interface GenerateRulePackageCandidatesFromReviewedCaseInput
  extends ContractGenerateRulePackageCandidatesFromReviewedCaseInput {}

export interface CreateRulePackageExampleSourceSessionInput
  extends ContractCreateRulePackageExampleSourceSessionInput {}

export type LoadRulePackageWorkspaceInput = RulePackageWorkspaceSourceInput;

export interface RulePackageWorkspaceResult extends RulePackageWorkspace {}

export interface RulePackageExampleSourceSessionResult
  extends RulePackageExampleSourceSession {}

export interface PreviewRulePackageDraftInput extends RulePackagePreviewInput {}

export interface RulePackageRecognitionResult extends RulePackageCandidate {}

export interface PreviewCompileRulePackagesInput
  extends ContractPreviewCompileRulePackagesInput {}

export interface RulePackageCompilePreviewResult
  extends RulePackageCompilePreview {}

export interface CompiledEditorialRuleSeedResult
  extends CompiledEditorialRuleSeed {}

export interface CompileRulePackagesToDraftInput
  extends PreviewCompileRulePackagesInput {
  actorRole: RoleKey;
  targetRuleSetId?: string;
}

export interface CompileRulePackagesToDraftResult {
  rule_set_id: string;
  target_mode: RulePackageCompileTargetMode;
  created_rule_ids: string[];
  replaced_rule_ids: string[];
  skipped_packages: Array<{
    package_id: string;
    reason: string;
  }>;
  publish_readiness: RulePackageCompilePublishReadiness;
  projection_readiness: RulePackageCompileProjectionReadiness;
}
