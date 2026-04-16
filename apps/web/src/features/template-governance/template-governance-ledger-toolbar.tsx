import type { FormEvent, ReactNode } from "react";
import type { TemplateGovernanceLedgerDensity } from "./template-governance-ledger-types.ts";
import type { TemplateGovernanceNavigationItem } from "./template-governance-navigation.ts";

export interface TemplateGovernanceLedgerToolbarProps {
  title: string;
  subtitle?: string;
  searchValue?: string;
  searchPlaceholder?: string;
  density?: TemplateGovernanceLedgerDensity;
  navigationItems?: readonly TemplateGovernanceNavigationItem[];
  actions?: ReactNode;
  onSearchValueChange?: (value: string) => void;
  onSearchSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}

export function TemplateGovernanceLedgerToolbar({
  title,
  subtitle,
  searchValue = "",
  searchPlaceholder = "搜索当前台账",
  density = "comfortable",
  navigationItems,
  actions,
  onSearchValueChange,
  onSearchSubmit,
}: TemplateGovernanceLedgerToolbarProps) {
  return (
    <header className="template-governance-ledger-toolbar">
      <div className="template-governance-ledger-toolbar-copy">
        <p className="template-governance-eyebrow">规则中心台账</p>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {navigationItems?.length ? (
        <nav className="template-governance-ledger-nav" aria-label="规则中心切换">
          {navigationItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`template-governance-ledger-nav-item${item.isActive ? " is-active" : ""}${item.priority === "secondary" ? " is-secondary" : ""}`}
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ))}
        </nav>
      ) : null}
      <div className="template-governance-ledger-toolbar-controls">
        <form className="template-governance-ledger-search" onSubmit={onSearchSubmit}>
          <input
            name="template-governance-search"
            value={searchValue}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            onChange={(event) => onSearchValueChange?.(event.target.value)}
          />
          <button type="submit">查找</button>
        </form>
        <div
          className={`template-governance-ledger-toolbar-actions template-governance-ledger-toolbar-actions--${density}`}
        >
          {actions}
        </div>
      </div>
    </header>
  );
}
