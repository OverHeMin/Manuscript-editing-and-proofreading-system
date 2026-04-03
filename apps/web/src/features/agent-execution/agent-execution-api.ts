import type {
  AgentExecutionLogViewModel,
  CompleteAgentExecutionLogInput,
  CreateAgentExecutionLogInput,
} from "./types.ts";

export interface AgentExecutionHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function createAgentExecutionLog(
  client: AgentExecutionHttpClient,
  input: CreateAgentExecutionLogInput,
) {
  return client.request<AgentExecutionLogViewModel>({
    method: "POST",
    url: "/api/v1/agent-execution",
    body: {
      input: {
        manuscriptId: input.manuscriptId,
        module: input.module,
        triggeredBy: input.triggeredBy,
        runtimeId: input.runtimeId,
        sandboxProfileId: input.sandboxProfileId,
        agentProfileId: input.agentProfileId,
        runtimeBindingId: input.runtimeBindingId,
        toolPermissionPolicyId: input.toolPermissionPolicyId,
        knowledgeItemIds: input.knowledgeItemIds,
        verificationCheckProfileIds: input.verificationCheckProfileIds,
        evaluationSuiteIds: input.evaluationSuiteIds,
        releaseCheckProfileId: input.releaseCheckProfileId,
      },
    },
  });
}

export function completeAgentExecutionLog(
  client: AgentExecutionHttpClient,
  input: CompleteAgentExecutionLogInput,
) {
  return client.request<AgentExecutionLogViewModel>({
    method: "POST",
    url: `/api/v1/agent-execution/${input.logId}/complete`,
    body: {
      executionSnapshotId: input.executionSnapshotId,
      verificationEvidenceIds: input.verificationEvidenceIds,
    },
  });
}

export function getAgentExecutionLog(
  client: AgentExecutionHttpClient,
  logId: string,
) {
  return client.request<AgentExecutionLogViewModel>({
    method: "GET",
    url: `/api/v1/agent-execution/${logId}`,
  });
}

export function listAgentExecutionLogs(client: AgentExecutionHttpClient) {
  return client.request<AgentExecutionLogViewModel[]>({
    method: "GET",
    url: "/api/v1/agent-execution",
  });
}
