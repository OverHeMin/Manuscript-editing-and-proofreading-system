import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { semanticTableDocxBase64 } from "../../../test-support/semantic-table-docx.ts";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";

test("proofreading confirmation page shows lossless DOCX table evidence from the draft job", async ({
  page,
  request,
}) => {
  await loginApiSession(request);

  const uploadResponse = await request.post(`${apiBaseUrl}/api/v1/manuscripts/upload`, {
    data: {
      title: `Proofreading Table Evidence ${Date.now()}`,
      manuscriptType: "clinical_study",
      createdBy: "ignored-by-server",
      fileName: "proofreading-table-evidence.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileContentBase64: semanticTableDocxBase64,
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();
  const uploaded = (await uploadResponse.json()) as {
    manuscript: { id: string };
    asset: { id: string };
  };

  const draftResponse = await request.post(
    `${apiBaseUrl}/api/v1/modules/proofreading/draft`,
    {
      data: {
        manuscriptId: uploaded.manuscript.id,
        parentAssetId: uploaded.asset.id,
        storageKey: `runs/${uploaded.manuscript.id}/proofreading/table-evidence-draft.md`,
        fileName: "table-evidence-draft.md",
      },
    },
  );
  expect(draftResponse.ok()).toBeTruthy();
  const draft = (await draftResponse.json()) as {
    asset: { id: string; source_job_id?: string };
  };

  const draftJob = await waitForJob(request, draft.asset.source_job_id ?? "");
  expect(draftJob.payload?.proofreadingTableEvidence?.tables?.length ?? 0).toBeGreaterThan(
    0,
  );

  const finalizeResponse = await request.post(
    `${apiBaseUrl}/api/v1/modules/proofreading/finalize`,
    {
      data: {
        manuscriptId: uploaded.manuscript.id,
        draftAssetId: draft.asset.id,
        storageKey: `runs/${uploaded.manuscript.id}/proofreading/table-evidence-final.docx`,
        fileName: "table-evidence-final.docx",
      },
    },
  );
  expect(finalizeResponse.ok()).toBeTruthy();
  const finalized = (await finalizeResponse.json()) as {
    asset: { id: string };
  };

  await page.goto(
    `/#proofreading?manuscriptId=${uploaded.manuscript.id}&assetId=${finalized.asset.id}&presentation=fullscreen`,
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(page.locator('[data-detail-kind="proofreading_confirmation"]')).toBeVisible();
  const evidencePanel = page.getByRole("region", { name: "表格无损证据" });
  await expect(evidencePanel).toBeVisible();
  await expect(evidencePanel).toContainText("表格无损证据");
  await expect(evidencePanel).toContainText("表格数");
  await expect(evidencePanel).toContainText("U+");
});

async function loginApiSession(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${apiBaseUrl}/api/v1/auth/local/login`, {
    data: {
      username: "dev.admin",
      password: "demo-password",
    },
  });
  expect(response.ok()).toBeTruthy();
}

async function waitForJob(
  request: APIRequestContext,
  jobId: string,
): Promise<{
  status?: string;
  payload?: {
    proofreadingTableEvidence?: {
      tables?: unknown[];
    };
  };
}> {
  await expect
    .poll(async () => {
      if (!jobId) {
        return false;
      }
      const response = await request.get(`${apiBaseUrl}/api/v1/jobs/${jobId}`);
      if (!response.ok()) {
        return false;
      }
      const job = (await response.json()) as {
        status?: string;
        payload?: {
          proofreadingTableEvidence?: {
            tables?: unknown[];
          };
        };
      };
      return (
        job.status === "completed" &&
        (job.payload?.proofreadingTableEvidence?.tables?.length ?? 0) > 0
      );
    }, { timeout: 30_000 })
    .toBe(true);

  const response = await request.get(`${apiBaseUrl}/api/v1/jobs/${jobId}`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as {
    status?: string;
    payload?: {
      proofreadingTableEvidence?: {
        tables?: unknown[];
      };
    };
  };
}
