export interface ManuscriptWorkbenchNoticeProps {
  tone: "success" | "error";
  title: string;
  message: string;
}

export function ManuscriptWorkbenchNotice({
  tone,
  title,
  message,
}: ManuscriptWorkbenchNoticeProps) {
  return (
    <article
      className={`manuscript-workbench-notice is-${tone}`}
      data-notice-layout="inline-strip"
      role={tone === "error" ? "alert" : "status"}
    >
      <strong>{title}</strong>
      <p>{message}</p>
    </article>
  );
}
