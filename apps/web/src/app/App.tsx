import { useEffect, useState } from "react";
import {
  isDevelopmentSessionBootstrapEnabled,
  resolveDevSession,
} from "./dev-session.ts";
import { ensureDemoBackendSession } from "./demo-backend-session.ts";
import { PersistentAuthShell } from "./persistent-auth-shell.tsx";
import { resolveWorkbenchRuntimeMode } from "./persistent-session.ts";
import { WorkbenchHost } from "./workbench-host.tsx";

export default function App() {
  if (resolveWorkbenchRuntimeMode(import.meta.env) === "persistent") {
    return (
      <PersistentAuthShell
        renderAuthenticated={({ session, onLogout, isLogoutPending, noticeMessage }) => (
          <WorkbenchHost
            session={session}
            onLogout={onLogout}
            isLogoutPending={isLogoutPending}
            noticeMessage={noticeMessage}
          />
        )}
      />
    );
  }

  return <DemoApp />;
}

function DemoApp() {
  if (!isDevelopmentSessionBootstrapEnabled()) {
    return (
      <main className="app-shell">
        <section className="workbench-host">
          <header className="workbench-header">
            <h1>Reviewer Workbench Host</h1>
            <p>
              Demo bootstrap is limited to local development mode.
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
                <h2>Demo Runtime Unavailable</h2>
                <p>
                  `VITE_APP_ENV=local` keeps the demo bootstrap path, but it still depends on the
                  Vite development server.
                </p>
                <p>
                  Use `VITE_APP_ENV=dev` or another persistent app environment to load the real
                  backend login shell.
                </p>
              </article>
            </section>
          </div>
        </section>
      </main>
    );
  }

  const [session] = useState(() => resolveDevSession());
  const [bootstrapStatus, setBootstrapStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void ensureDemoBackendSession(session)
      .then(() => {
        if (cancelled) {
          return;
        }

        setBootstrapStatus("ready");
        setBootstrapError(null);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setBootstrapStatus("error");
        setBootstrapError(
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "Unable to establish the demo backend session.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  if (bootstrapStatus === "loading") {
    return (
      <main className="app-shell">
        <section className="workbench-host">
          <header className="workbench-header">
            <h1>Reviewer Workbench Host</h1>
            <p>
              Connecting <strong>{session.displayName}</strong> to the local demo backend.
            </p>
          </header>

          <section className="workbench-content">
            <article className="workbench-placeholder app-phase-placeholder" role="status">
              <h2>Establishing Session</h2>
              <p>
                The development workbench waits for a trusted backend cookie before loading review
                routes.
              </p>
            </article>
          </section>
        </section>
      </main>
    );
  }

  if (bootstrapStatus === "error") {
    return (
      <main className="app-shell">
        <section className="workbench-host">
          <header className="workbench-header">
            <h1>Reviewer Workbench Host</h1>
            <p>
              Local demo backend login failed for <strong>{session.username}</strong>.
            </p>
          </header>

          <section className="workbench-content">
            <article className="workbench-placeholder app-phase-placeholder" role="alert">
              <h2>Backend Session Error</h2>
              <p>{bootstrapError ?? "Unable to establish the demo backend session."}</p>
              <p>
                Check that the API dev server is running and that `VITE_DEMO_PASSWORD` matches the
                local demo account password.
              </p>
            </article>
          </section>
        </section>
      </main>
    );
  }

  return (
    <WorkbenchHost session={session} />
  );
}
