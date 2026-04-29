export type TemplateGovernanceV2Command =
  | "new-rule"
  | "new-ai-rule"
  | "import-extraction"
  | "review-candidates"
  | "release-check";

export interface TemplateGovernanceV2CommandBarProps {
  onCommand: (command: TemplateGovernanceV2Command) => void;
}

const commands: Array<{ id: TemplateGovernanceV2Command; label: string }> = [
  { id: "new-rule", label: "新建规则" },
  { id: "new-ai-rule", label: "新建 AI 规则草稿" },
  { id: "import-extraction", label: "导入提取任务" },
  { id: "review-candidates", label: "复核候选" },
  { id: "release-check", label: "发布检查" },
];

export function TemplateGovernanceV2CommandBar({
  onCommand,
}: TemplateGovernanceV2CommandBarProps) {
  return (
    <div className="rule-center-v2__command-bar" aria-label="规则中心操作">
      {commands.map((command) => (
        <button
          key={command.id}
          type="button"
          data-command={command.id}
          onClick={() => onCommand(command.id)}
        >
          {command.label}
        </button>
      ))}
    </div>
  );
}
