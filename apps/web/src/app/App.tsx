import {
  isDevelopmentSessionBootstrapEnabled,
  resolveDevSession,
} from "./dev-session.ts";
import { WorkbenchHost } from "./workbench-host.tsx";

export default function App() {
  if (!isDevelopmentSessionBootstrapEnabled()) {
    return (
      <main className="app-shell">
        <section className="workbench-host">
          <header className="workbench-header">
            <h1>Reviewer Workbench Host</h1>
            <p>
              Session context is unavailable in non-development mode.
            </p>
          </header>

          <div className="workbench-layout">
            <aside className="workbench-nav" aria-label="Workbench navigation">
              <h2>Workbenches</h2>
              <ul className="workbench-nav-list">
                <li>
                  <button type="button" className="workbench-nav-button is-disabled" disabled>
                    <span>Role-aware Workbench Access</span>
                    <small>pending auth</small>
                  </button>
                </li>
              </ul>
            </aside>

            <section className="workbench-content">
              <article className="workbench-placeholder app-phase-placeholder" role="status">
                <h2>Workbench Host Placeholder</h2>
                <p>
                  Development bootstrap auth is disabled outside development mode.
                </p>
                <p>
                  Production auth and role-aware host wiring are intentionally out of scope for
                  Phase 7B.
                </p>
              </article>
            </section>
          </div>
        </section>
      </main>
    );
  }

  const session = resolveDevSession();

  return (
    <WorkbenchHost session={session} />
  );
}
