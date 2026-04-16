import type { TemplateModule } from "../templates/template-record.ts";

export interface BareModulePromptSkeleton {
  id: string;
  module: TemplateModule;
  templateId: string;
  executionProfileId: string;
  moduleTemplateVersionNo: number;
  promptTemplateVersion: string;
  systemInstructions: string;
  taskFrame: string;
  outputContract: string;
  reportStyle?: string;
  allowedContentOperations?: string[];
  forbiddenOperations?: string[];
}

const BARE_MODULE_PROMPT_SKELETONS: Record<
  TemplateModule,
  BareModulePromptSkeleton
> = {
  screening: {
    id: "bare-screening-prompt",
    module: "screening",
    templateId: "bare-screening-template",
    executionProfileId: "bare-screening-execution-profile",
    moduleTemplateVersionNo: 1,
    promptTemplateVersion: "bare-v1",
    systemInstructions:
      "Run a generic medical manuscript screening pass without template-family governance.",
    taskFrame:
      "Summarize manuscript type, structural readiness, and major risks from the current source asset.",
    outputContract:
      "Produce a normal screening-style report that can replace the current screening result for this run.",
    reportStyle: "Use concise operator-facing markdown.",
  },
  editing: {
    id: "bare-editing-prompt",
    module: "editing",
    templateId: "bare-editing-template",
    executionProfileId: "bare-editing-execution-profile",
    moduleTemplateVersionNo: 1,
    promptTemplateVersion: "bare-v1",
    systemInstructions:
      "Run a generic medical manuscript editing pass without template-family governance.",
    taskFrame:
      "Preserve medical meaning, improve clarity conservatively, and avoid governed template specialization.",
    outputContract:
      "Produce a normal editing output asset that can replace the current editing result for this run.",
    allowedContentOperations: ["sentence_rewrite", "paragraph_reshape"],
    forbiddenOperations: ["fabrication", "meaning_shift"],
  },
  proofreading: {
    id: "bare-proofreading-prompt",
    module: "proofreading",
    templateId: "bare-proofreading-template",
    executionProfileId: "bare-proofreading-execution-profile",
    moduleTemplateVersionNo: 1,
    promptTemplateVersion: "bare-v1",
    systemInstructions:
      "Run a generic medical manuscript proofreading pass without template-family governance.",
    taskFrame:
      "Inspect the current source asset for obvious risks and produce a standard proofreading draft report.",
    outputContract:
      "Produce the normal proofreading draft output for this run without changing downstream closeout semantics.",
    reportStyle: "Use concise reviewer-facing markdown.",
    forbiddenOperations: ["rewrite_manuscript", "meaning_shift"],
  },
};

export function getBareModulePromptSkeleton(
  module: TemplateModule,
): BareModulePromptSkeleton {
  const skeleton = BARE_MODULE_PROMPT_SKELETONS[module];

  return {
    ...skeleton,
    ...(skeleton.allowedContentOperations
      ? {
          allowedContentOperations: [...skeleton.allowedContentOperations],
        }
      : {}),
    ...(skeleton.forbiddenOperations
      ? {
          forbiddenOperations: [...skeleton.forbiddenOperations],
        }
      : {}),
  };
}
