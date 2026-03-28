import type { RoleKey } from "../../users/roles.ts";
import type {
  ApplyLearningWritebackInput,
  CreateLearningWritebackInput,
  LearningGovernanceService,
} from "./learning-governance-service.ts";
import type { LearningWritebackRecord } from "./learning-governance-record.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateLearningGovernanceApiOptions {
  learningGovernanceService: LearningGovernanceService;
}

export function createLearningGovernanceApi(
  options: CreateLearningGovernanceApiOptions,
) {
  const { learningGovernanceService } = options;

  return {
    async createWriteback({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateLearningWritebackInput;
    }): Promise<RouteResponse<LearningWritebackRecord>> {
      return {
        status: 201,
        body: await learningGovernanceService.createWriteback(actorRole, input),
      };
    },

    async applyWriteback({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: ApplyLearningWritebackInput;
    }): Promise<RouteResponse<LearningWritebackRecord>> {
      return {
        status: 200,
        body: await learningGovernanceService.applyWriteback(actorRole, input),
      };
    },

    async listWritebacksByCandidate({
      learningCandidateId,
    }: {
      learningCandidateId: string;
    }): Promise<RouteResponse<LearningWritebackRecord[]>> {
      return {
        status: 200,
        body: await learningGovernanceService.listWritebacksByCandidate(
          learningCandidateId,
        ),
      };
    },
  };
}
