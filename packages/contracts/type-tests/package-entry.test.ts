import type {
  DocumentAssetType,
  HumanFeedbackRecord,
  KnowledgeItemRouting,
  ModuleExecutionProfile,
  LearningRun,
  ManuscriptType,
  ResolvedModel,
  TemplateKnowledgeBinding,
} from "@medical/contracts";

type IsAny<T> = 0 extends 1 & T ? true : false;
type NotAny<T> = IsAny<T> extends true ? false : true;
type Assert<T extends true> = T;
type IsEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends <
  T
>() => T extends B ? 1 : 2
  ? true
  : false;

// Package entry must resolve and expose key surfaces.
type _LearningRunNotAny = Assert<NotAny<LearningRun>>;
type _TemplateKnowledgeBindingNotAny = Assert<NotAny<TemplateKnowledgeBinding>>;
type _ResolvedModelNotAny = Assert<NotAny<ResolvedModel>>;
type _ModuleExecutionProfileNotAny = Assert<NotAny<ModuleExecutionProfile>>;
type _HumanFeedbackRecordNotAny = Assert<NotAny<HumanFeedbackRecord>>;

// Spot-check a couple of tricky unions via the package entry.
type _DocumentAssetTypeHasFinalProofOutputs = Assert<
  IsEqual<
    Extract<DocumentAssetType, "final_proof_issue_report" | "final_proof_annotated_docx">,
    "final_proof_issue_report" | "final_proof_annotated_docx"
  >
>;

type _KnowledgeItemRoutingManuscriptTypesSupportsAny = Assert<
  IsEqual<KnowledgeItemRouting["manuscript_types"], ManuscriptType[] | "any">
>;

