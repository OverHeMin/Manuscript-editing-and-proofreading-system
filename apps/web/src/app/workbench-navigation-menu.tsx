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
          data-prominence={group.prominence}
        >
          <div className="workbench-nav-group-header">
            <h3>{group.label}</h3>
            <span className="workbench-nav-group-count">{`${group.items.length} 项`}</span>
          </div>
          <p className="workbench-nav-group-description">{group.description}</p>
          <ul className="workbench-nav-list">
            {group.items.map((item) => {
              const isActive = item.id === activeWorkbenchId;

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`workbench-nav-button${isActive ? " is-active" : ""}`}
                    data-emphasis={item.emphasis}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => onNavigate(item.id)}
                  >
                    <span className="workbench-nav-button-label">{item.label}</span>
                    <small>{item.description}</small>
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
