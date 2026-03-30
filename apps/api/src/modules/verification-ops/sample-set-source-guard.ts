import type {
  ReviewedCaseSnapshotRecord,
} from "../learning/learning-record.ts";
import type {
  ReviewedCaseSnapshotRepository,
} from "../learning/learning-repository.ts";
import type { TemplateModule } from "../templates/template-record.ts";

export class ReviewedCaseSnapshotRepositoryRequiredError extends Error {
  constructor() {
    super(
      "Reviewed case snapshot repository is required for evaluation sample-set operations.",
    );
    this.name = "ReviewedCaseSnapshotRepositoryRequiredError";
  }
}

export class EvaluationSampleSetSourceSnapshotNotFoundError extends Error {
  constructor(snapshotId: string) {
    super(`Reviewed case snapshot ${snapshotId} was not found.`);
    this.name = "EvaluationSampleSetSourceSnapshotNotFoundError";
  }
}

export class EvaluationSampleSetSourceEligibilityError extends Error {
  constructor(snapshotId: string, reason: string) {
    super(`Reviewed case snapshot ${snapshotId} is not eligible: ${reason}.`);
    this.name = "EvaluationSampleSetSourceEligibilityError";
  }
}

export async function requireEligibleReviewedCaseSnapshot(
  repository: ReviewedCaseSnapshotRepository | undefined,
  snapshotId: string,
  expectedModule: TemplateModule,
): Promise<ReviewedCaseSnapshotRecord & { module: TemplateModule }> {
  if (!repository) {
    throw new ReviewedCaseSnapshotRepositoryRequiredError();
  }

  const snapshot = await repository.findById(snapshotId);
  if (!snapshot) {
    throw new EvaluationSampleSetSourceSnapshotNotFoundError(snapshotId);
  }

  // Phase 6A only allows governed historical samples that already passed the
  // human-final + de-identification pipeline before entering offline experiments.
  if (!snapshot.deidentification_passed) {
    throw new EvaluationSampleSetSourceEligibilityError(
      snapshotId,
      "de-identification has not passed",
    );
  }

  if (!snapshot.human_final_asset_id || !snapshot.snapshot_asset_id) {
    throw new EvaluationSampleSetSourceEligibilityError(
      snapshotId,
      "required governed source assets are missing",
    );
  }

  if (snapshot.module !== expectedModule) {
    throw new EvaluationSampleSetSourceEligibilityError(
      snapshotId,
      `expected module ${expectedModule} but received ${snapshot.module}`,
    );
  }

  return snapshot as ReviewedCaseSnapshotRecord & { module: TemplateModule };
}
