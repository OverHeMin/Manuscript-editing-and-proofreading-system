import { useEffect, useState } from "react";
import {
  isDevelopmentSessionBootstrapEnabled,
  resolveDevSession,
} from "./dev-session.ts";
import { ensureDemoBackendSession } from "./demo-backend-session.ts";
import { AuthShellScaffold, PersistentAuthShell } from "./persistent-auth-shell.tsx";
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
      <AuthShellScaffold
        cardKicker="本地开发"
        cardTitle="演示运行时不可用"
        cardDescription="当前入口仍处于本地开发引导模式，请切换到可建立会话的环境后继续。"
        cardRole="status"
      >
        <div className="auth-stage-stack">
          <p>
            <code>VITE_APP_ENV=local</code> 会保留演示引导路径，但仍依赖当前 Vite 开发服务。
          </p>
          <p>
            如果要进入真实后端登录壳层，请切换到 <code>VITE_APP_ENV=dev</code> 或其他持久环境。
          </p>
        </div>
      </AuthShellScaffold>
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
      <AuthShellScaffold
        cardKicker="演示会话"
        cardTitle="正在建立演示会话"
        cardDescription={`正在为 ${session.displayName} 连接本地演示后端。`}
        cardRole="status"
      >
        <div className="auth-stage-stack">
          <p>本地开发工作台会先建立可信后端会话，再加载各条工作线。</p>
        </div>
      </AuthShellScaffold>
    );
  }

  if (bootstrapStatus === "error") {
    return (
      <AuthShellScaffold
        cardKicker="演示会话"
        cardTitle="后端会话异常"
        cardDescription={`本地演示后端登录未成功，当前账号为 ${session.username}。`}
        cardRole="alert"
      >
        <div className="auth-stage-stack">
          <p className="auth-error-message">{bootstrapError ?? "无法建立演示后端会话。"}</p>
          <p>
            请确认 API 开发服务正在运行，并且 <code>VITE_DEMO_PASSWORD</code> 与本地演示账号密码一致。
          </p>
        </div>
      </AuthShellScaffold>
    );
  }

  return (
    <WorkbenchHost session={session} />
  );
}
