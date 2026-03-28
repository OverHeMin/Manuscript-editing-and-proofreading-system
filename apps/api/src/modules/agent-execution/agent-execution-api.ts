import type { AgentExecutionLogRecord } from "./agent-execution-record.ts";
import type {
  AgentExecutionService,
  CompleteAgentExecutionLogInput,
  CreateAgentExecutionLogInput,
} from "./agent-execution-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateAgentExecutionApiOptions {
  agentExecutionService: AgentExecutionService;
}

export function createAgentExecutionApi(
  options: CreateAgentExecutionApiOptions,
) {
  const { agentExecutionService } = options;

  return {
    async createLog({
      input,
    }: {
      input: CreateAgentExecutionLogInput;
    }): Promise<RouteResponse<AgentExecutionLogRecord>> {
      return {
        status: 201,
        body: await agentExecutionService.createLog(input),
      };
    },

    async completeLog({
      logId,
      executionSnapshotId,
      verificationEvidenceIds,
    }: CompleteAgentExecutionLogInput): Promise<RouteResponse<AgentExecutionLogRecord>> {
      return {
        status: 200,
        body: await agentExecutionService.completeLog({
          logId,
          executionSnapshotId,
          verificationEvidenceIds,
        }),
      };
    },

    async getLog({
      logId,
    }: {
      logId: string;
    }): Promise<RouteResponse<AgentExecutionLogRecord>> {
      return {
        status: 200,
        body: await agentExecutionService.getLog(logId),
      };
    },

    async listLogs(): Promise<RouteResponse<AgentExecutionLogRecord[]>> {
      return {
        status: 200,
        body: await agentExecutionService.listLogs(),
      };
    },
  };
}
