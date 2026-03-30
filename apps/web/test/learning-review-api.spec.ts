import test from "node:test";
import assert from "node:assert/strict";
import {
  createReviewedCaseSnapshot,
  getLearningCandidate,
  listLearningCandidates,
  listPendingLearningReviewCandidates,
} from "../src/features/learning-review/learning-review-api.ts";

test("learning review client targets the reviewed-case snapshot endpoint", async () => {
  const requests: Array<{
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }> = [];

  const client = {
    async request<TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) {
      requests.push(input);
      return {
        status: 201,
        body: {
          id: "snapshot-1",
        } as TResponse,
      };
    },
  };

  await createReviewedCaseSnapshot(client, {
    manuscriptId: "manuscript-1",
    module: "editing",
    manuscriptType: "clinical_study",
    humanFinalAssetId: "asset-1",
    deidentificationPassed: true,
    requestedBy: "editor-1",
    storageKey: "learning/manuscript-1/snapshot.bin",
  });

  assert.equal(requests[0]?.method, "POST");
  assert.equal(
    requests[0]?.url,
    "/api/v1/learning/reviewed-case-snapshots",
  );
});

test("learning review client exposes list and detail query routes", async () => {
  const requests: Array<{
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }> = [];

  const client = {
    async request<TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) {
      requests.push(input);
      return {
        status: 200,
        body: [] as unknown as TResponse,
      };
    },
  };

  await listLearningCandidates(client);
  await listPendingLearningReviewCandidates(client);
  await getLearningCandidate(client, "candidate-1");

  assert.deepEqual(
    requests.map((request) => ({
      method: request.method,
      url: request.url,
    })),
    [
      {
        method: "GET",
        url: "/api/v1/learning/candidates",
      },
      {
        method: "GET",
        url: "/api/v1/learning/candidates/review-queue",
      },
      {
        method: "GET",
        url: "/api/v1/learning/candidates/candidate-1",
      },
    ],
  );
});
