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
            <aside className="workbench-nav" aria-label="工作区导航">
              <h2>工作区导航</h2>
              <ul className="workbench-nav-list">
                <li>
                  <button type="button" className="workbench-nav-button is-disabled" disabled>
                    <span>待进入工作区</span>
                    <small>等待会话初始化</small>
                  </button>
                </li>
              </ul>
            </aside>

            <section className="workbench-content">
              <article className="workbench-placeholder app-phase-placeholder" role="status">
                <h2>演示运行时不可用</h2>
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
            : "无法建立演示后端会话。",
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
              <h2>正在建立会话</h2>
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
              <h2>后端会话异常</h2>
              <p>{bootstrapError ?? "无法建立演示后端会话。"}</p>
              <p>
                请确认 API 开发服务正在运行，并且 `VITE_DEMO_PASSWORD` 与本地演示账号密码一致。
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
