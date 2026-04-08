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
            <h1>医学稿件处理系统</h1>
            <p>
              当前页面保留本地开发引导，用于连接演示会话或真实后端登录流程。
            </p>
          </header>

          <div className="workbench-layout">
            <aside className="workbench-nav" aria-label="Workbench navigation">
              <h2>Workbench</h2>
              <ul className="workbench-nav-list">
                <li>
                  <button type="button" className="workbench-nav-button is-disabled" disabled>
                    <span>待进入工作区</span>
                    <small>Awaiting session bootstrap</small>
                  </button>
                </li>
              </ul>
            </aside>

            <section className="workbench-content">
            <article className="workbench-placeholder app-phase-placeholder" role="status">
              <h2>Demo Runtime Unavailable</h2>
              <p>
                  `VITE_APP_ENV=local` 会保留演示引导路径，但仍依赖当前 Vite 开发服务。
              </p>
              <p>
                  如果要进入真实后端登录壳层，请切换到 `VITE_APP_ENV=dev` 或其他持久环境。
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
            <h1>医学稿件处理系统</h1>
            <p>
              正在为 <strong>{session.displayName}</strong> 连接本地演示后端。
            </p>
          </header>

          <section className="workbench-content">
            <article className="workbench-placeholder app-phase-placeholder" role="status">
              <h2>Establishing Session</h2>
              <p>
                本地开发工作台会先建立可信后端会话，再加载各条工作线。
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
            <h1>医学稿件处理系统</h1>
            <p>
              本地演示后端登录未成功，当前账号为 <strong>{session.username}</strong>。
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
