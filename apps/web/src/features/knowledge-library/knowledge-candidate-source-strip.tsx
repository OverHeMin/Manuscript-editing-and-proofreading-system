import type { KnowledgeCandidateSourceSummary } from "./knowledge-candidate-prefill.ts";

export interface KnowledgeCandidateSourceStripProps {
  source: KnowledgeCandidateSourceSummary;
}

export function KnowledgeCandidateSourceStrip({
  source,
}: KnowledgeCandidateSourceStripProps) {
  return (
    <section
      className="knowledge-candidate-source-strip"
      aria-label="知识回流来源"
    >
      <header>
        <span>{source.provenanceLabel}</span>
        <strong>{source.candidateId}</strong>
      </header>
      <dl>
        <div>
          <dt>稿件</dt>
          <dd>{source.manuscriptId ?? "未绑定"}</dd>
        </div>
        <div>
          <dt>模块</dt>
          <dd>{source.module}</dd>
        </div>
        <div>
          <dt>来源资产</dt>
          <dd>{source.sourceAssetId ?? "未记录"}</dd>
        </div>
      </dl>
      {source.evidenceSummary ? <p>{source.evidenceSummary}</p> : null}
    </section>
  );
}
