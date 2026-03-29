import { resolveDevSession } from "./dev-session.ts";
import { WorkbenchHost } from "./workbench-host.tsx";

export default function App() {
  const session = resolveDevSession();

  return (
    <WorkbenchHost session={session} />
  );
}
