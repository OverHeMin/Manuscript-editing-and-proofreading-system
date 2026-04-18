import type { RoleKey } from "../../users/roles.ts";
import type { LearningCandidateRecord } from "../learning/learning-record.ts";
import type { EvaluationRunRecord } from "../verification-ops/verification-ops-record.ts";
import type { VerificationOpsService } from "../verification-ops/verification-ops-service.ts";
import {
  ResidualIssueCandidateRouteNotSupportedError,
  ResidualIssueSourceAssetRequiredError,
  ResidualLearningService,
} from "./residual-learning-service.ts";
import type { ResidualIssueRecord } from "./residual-learning-record.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateResidualLearningApiOptions {
  residualLearningService: ResidualLearningService;
  verificationOpsService: Pick<
    VerificationOpsService,
    "seedGovernedExecutionRuns" | "executeSeededGovernedRunChecks"
  >;
}

export class ResidualIssueExecutionLogRequiredError extends Error {
  constructor(issueId: string) {
    super(`Residual issue ${issueId} requires an execution log for validation.`);
    this.name = "ResidualIssueExecutionLogRequiredError";
  }
}

export function createResidualLearningApi(
  options: CreateResidualLearningApiOptions,
) {
  const { residualLearningService, verificationOpsService } = options;

  return {
    async listIssues(): Promise<RouteResponse<ResidualIssueRecord[]>> {
      return {
        status: 200,
        body: await residualLearningService.listIssues(),
      };
    },

    async getIssue({
      issueId,
    }: {
      issueId: string;
    }): Promise<RouteResponse<ResidualIssueRecord>> {
      return {
        status: 200,
        body: await residualLearningService.getIssue(issueId),
      };
    },

    async validateIssue(input: {
      issueId: string;
      actorRole: RoleKey;
      suiteIds: string[];
      releaseCheckProfileId?: string;
    }): Promise<RouteResponse<{ issue: ResidualIssueRecord; run: EvaluationRunRecord }>> {
      const issue = await residualLearningService.getIssue(input.issueId);
      const governedSource = buildGovernedSourceForResidualValidation(issue);
      const [run] = await verificationOpsService.seedGovernedExecutionRuns(
        input.actorRole,
        {
          suiteIds: input.suiteIds,
          releaseCheckProfileId: input.releaseCheckProfileId,
          governedSource,
        },
      );
      const completedRun =
        await verificationOpsService.executeSeededGovernedRunChecks(
          input.actorRole,
          {
            runId: run.id,
          },
        );

      return {
        status: 200,
        body: {
          issue: await residualLearningService.getIssue(input.issueId),
          run: completedRun,
        },
      };
    },

    async createLearningCandidate(input: {
      issueId: string;
      requestedBy: string;
      requestedByRole?: RoleKey;
      title?: string;
      proposalText?: string;
    }): Promise<RouteResponse<LearningCandidateRecord>> {
      return {
        status: 201,
        body: await residualLearningService.createLearningCandidateFromIssue(
          input,
        ),
      };
    },
  };
}

function buildGovernedSourceForResidualValidation(
  issue: ResidualIssueRecord,
): NonNullable<EvaluationRunRecord["governed_source"]> {
  if (!issue.output_asset_id) {
    throw new ResidualIssueSourceAssetRequiredError(issue.id);
  }
  if (!issue.agent_execution_log_id) {
    throw new ResidualIssueExecutionLogRequiredError(issue.id);
  }

  if (
    issue.recommended_route === "manual_only" ||
    issue.recommended_route === "evidence_only"
  ) {
    throw new ResidualIssueCandidateRouteNotSupportedError(
      issue.id,
      issue.recommended_route,
    );
  }

  return {
    source_kind: "governed_module_execution",
    manuscript_id: issue.manuscript_id,
    source_module: issue.module,
    agent_execution_log_id: issue.agent_execution_log_id,
    execution_snapshot_id: issue.execution_snapshot_id,
    output_asset_id: issue.output_asset_id,
    residual_issue_id: issue.id,
  };
}
