import type { ManualReviewPolicyRecord } from "./manual-review-policy-record.ts";

export interface ManualReviewPolicyRepository {
  save(record: ManualReviewPolicyRecord): Promise<void>;
  findById(id: string): Promise<ManualReviewPolicyRecord | undefined>;
  listByScope(
    module: ManualReviewPolicyRecord["module"],
    manuscriptType: ManualReviewPolicyRecord["manuscript_type"],
    templateFamilyId: ManualReviewPolicyRecord["template_family_id"],
    activeOnly?: boolean,
  ): Promise<ManualReviewPolicyRecord[]>;
  reserveNextVersion(
    module: ManualReviewPolicyRecord["module"],
    manuscriptType: ManualReviewPolicyRecord["manuscript_type"],
    templateFamilyId: ManualReviewPolicyRecord["template_family_id"],
  ): Promise<number>;
}
