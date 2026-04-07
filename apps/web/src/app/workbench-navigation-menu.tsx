import type { WorkbenchId } from "../features/auth/index.ts";
import type { WorkbenchNavigationGroup } from "./workbench-navigation.ts";

export interface WorkbenchNavigationMenuProps {
  groups: readonly WorkbenchNavigationGroup[];
  activeWorkbenchId: WorkbenchId;
  onNavigate: (workbenchId: WorkbenchId) => void;
}

export function WorkbenchNavigationMenu({
  groups,
  activeWorkbenchId,
  onNavigate,
}: WorkbenchNavigationMenuProps) {
  return (
    <div className="workbench-nav-groups">
      {groups.map((group) => (
        <section
          key={group.id}
          className={`workbench-nav-group workbench-nav-group--${group.id}`}
        >
          <h3>{group.label}</h3>
          <ul className="workbench-nav-list">
            {group.items.map((item) => {
              const isActive = item.id === activeWorkbenchId;

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`workbench-nav-button${isActive ? " is-active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => onNavigate(item.id)}
                  >
                    <span>{item.label}</span>
                    <small>{item.entry.label}</small>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
