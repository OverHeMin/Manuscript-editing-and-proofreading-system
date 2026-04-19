import { accessSync, constants } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const projectDefinitions = {
  api: {
    label: "API",
    configPath: path.join(repoRoot, "apps", "api", "tsconfig.json"),
    typeRoots: [
      path.join(repoRoot, ".codex-tmp", "runner", "node_modules", "@types"),
    ],
    paths: {
      bcryptjs: [path.join(repoRoot, "scripts", "typecheck-shims", "api", "bcryptjs", "index.d.ts")],
      pg: [path.join(repoRoot, "scripts", "typecheck-shims", "api", "pg", "index.d.ts")],
    },
  },
  web: {
    label: "Web",
    configPath: path.join(repoRoot, "apps", "web", "tsconfig.json"),
    typeRoots: [
      path.join(repoRoot, ".codex-tmp", "runner", "node_modules", "@types"),
    ],
    paths: {
      react: [path.join(repoRoot, ".codex-tmp", "runner", "node_modules", "@types", "react", "index.d.ts")],
      "react/jsx-runtime": [
        path.join(repoRoot, ".codex-tmp", "runner", "node_modules", "@types", "react", "jsx-runtime.d.ts"),
      ],
      "react/jsx-dev-runtime": [
        path.join(repoRoot, ".codex-tmp", "runner", "node_modules", "@types", "react", "jsx-dev-runtime.d.ts"),
      ],
      "react-dom": [
        path.join(repoRoot, ".codex-tmp", "runner", "node_modules", "@types", "react-dom", "index.d.ts"),
      ],
      "react-dom/client": [
        path.join(repoRoot, ".codex-tmp", "runner", "node_modules", "@types", "react-dom", "client.d.ts"),
      ],
    },
  },
};

const typescriptCompilerCandidates = [
  path.join(repoRoot, ".codex-tmp", "runner", "node_modules", "typescript", "lib", "typescript.js"),
  path.join(repoRoot, "node_modules", "typescript", "lib", "typescript.js"),
  path.join(repoRoot, "apps", "api", "node_modules", "typescript", "lib", "typescript.js"),
  path.join(repoRoot, "apps", "web", "node_modules", "typescript", "lib", "typescript.js"),
];

const args = process.argv.slice(2);
const requestedProjects = resolveRequestedProjects(args);
const ts = loadTypescript();

let hasErrors = false;

for (const projectKey of requestedProjects) {
  const project = projectDefinitions[projectKey];
  console.log(`\n==> ${project.label} typecheck`);

  const { diagnostics, fileCount } = runProjectTypecheck(ts, project);
  if (diagnostics.length === 0) {
    console.log(`[workspace-typecheck] ${project.label} passed (${fileCount} files).`);
    continue;
  }

  hasErrors = true;
  process.stderr.write(
    `${ts.formatDiagnosticsWithColorAndContext(diagnostics, createDiagnosticHost(ts))}\n`,
  );
}

if (hasErrors) {
  process.exitCode = 1;
}

function resolveRequestedProjects(values) {
  if (values.length === 0) {
    return ["api", "web"];
  }

  const requested = [];
  for (const value of values) {
    if (!(value in projectDefinitions)) {
      throw new Error(
        `Unknown workspace-typecheck target: ${value}. Expected one or more of: ${Object.keys(projectDefinitions).join(", ")}`,
      );
    }

    if (!requested.includes(value)) {
      requested.push(value);
    }
  }

  return requested;
}

function loadTypescript() {
  for (const candidate of typescriptCompilerCandidates) {
    if (!canRead(candidate)) {
      continue;
    }

    return require(candidate);
  }

  throw new Error(
    `Unable to find a readable TypeScript compiler runtime. Checked: ${typescriptCompilerCandidates.join(", ")}`,
  );
}

function runProjectTypecheck(ts, project) {
  const configFile = ts.readConfigFile(project.configPath, ts.sys.readFile);
  if (configFile.error) {
    return { diagnostics: [configFile.error], fileCount: 0 };
  }

  const typeRoots = project.typeRoots.filter(canReadDirectory);
  const compilerOptions =
    typeRoots.length === 0
      ? {
          ...configFile.config.compilerOptions,
          noEmit: true,
          paths: {
            ...(configFile.config.compilerOptions?.paths ?? {}),
            ...(project.paths ?? {}),
          },
        }
      : {
          ...configFile.config.compilerOptions,
          noEmit: true,
          typeRoots,
          paths: {
            ...(configFile.config.compilerOptions?.paths ?? {}),
            ...(project.paths ?? {}),
          },
        };

  const parsedConfig = ts.parseJsonConfigFileContent(
    {
      ...configFile.config,
      compilerOptions,
    },
    ts.sys,
    path.dirname(project.configPath),
    undefined,
    project.configPath,
  );

  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options,
    projectReferences: parsedConfig.projectReferences,
  });

  return {
    diagnostics: [...parsedConfig.errors, ...ts.getPreEmitDiagnostics(program)],
    fileCount: parsedConfig.fileNames.length,
  };
}

function createDiagnosticHost(ts) {
  return {
    getCanonicalFileName(fileName) {
      return fileName;
    },
    getCurrentDirectory() {
      return repoRoot;
    },
    getNewLine() {
      return ts.sys.newLine;
    },
  };
}

function canRead(filePath) {
  try {
    accessSync(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function canReadDirectory(directoryPath) {
  try {
    accessSync(directoryPath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
