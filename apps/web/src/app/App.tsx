import {
  isDevelopmentSessionBootstrapEnabled,
  resolveDevSession,
} from "./dev-session.ts";
import { WorkbenchHost } from "./workbench-host.tsx";

export default function App() {
  if (!isDevelopmentSessionBootstrapEnabled()) {
    return (
      <main className="app-shell">
        <section className="workbench-host app-phase-host">
          <article className="workbench-placeholder app-phase-placeholder" role="status">
            <h2>Workbench Host Placeholder</h2>
            <p>
              Development bootstrap auth is disabled outside development mode.
            </p>
            <p>
              Production auth and role-aware host wiring are intentionally out of scope for Phase
              7B.
            </p>
          </article>
        </section>
      </main>
    );
  }

  const session = resolveDevSession();

  return (
    <WorkbenchHost session={session} />
  );
}
