import { useMemo, useState } from "react";
import type {
  CreateManuscriptQualityPackageDraftInput,
  ManuscriptQualityPackageKind,
  ManuscriptQualityPackageViewModel,
} from "../manuscript-quality-packages/index.ts";
import {
  createDefaultGeneralStylePackageManifest,
  GeneralStylePackageEditor,
} from "./general-style-package-editor.tsx";
import {
  createDefaultMedicalAnalyzerPackageManifest,
  MedicalAnalyzerPackageEditor,
} from "./medical-analyzer-package-editor.tsx";

const defaultTargetScopesByKind: Record<
  ManuscriptQualityPackageKind,
  CreateManuscriptQualityPackageDraftInput["targetScopes"]
> = {
  general_style_package: ["general_proofreading"],
  medical_analyzer_package: ["medical_specialized"],
};

export interface ManuscriptQualityPackagesSectionProps {
  packages: readonly ManuscriptQualityPackageViewModel[];
  isMutating: boolean;
  surface?: "default" | "harness";
  onCreateDraft: (
    input: Omit<CreateManuscriptQualityPackageDraftInput, "actorRole">,
  ) => Promise<void>;
  onPublishVersion: (packageVersionId: string) => Promise<void>;
}

export function ManuscriptQualityPackagesSection(
  props: ManuscriptQualityPackagesSectionProps,
) {
  const isHarnessSurface = props.surface === "harness";
  const [packageKind, setPackageKind] =
    useState<ManuscriptQualityPackageKind>("general_style_package");
  const [packageName, setPackageName] = useState(
    resolveDefaultPackageName("general_style_package", props.surface),
  );
  const [targetScopes, setTargetScopes] = useState<
    CreateManuscriptQualityPackageDraftInput["targetScopes"]
  >([...defaultTargetScopesByKind.general_style_package]);
  const [manifestText, setManifestText] = useState(
    defaultManifestText("general_style_package"),
  );
  const [manifestError, setManifestError] = useState<string | null>(null);
  const parsedManifestState = useMemo(
    () => tryParseManifest(manifestText),
    [manifestText],
  );

  const sortedPackages = useMemo(
    () =>
      [...props.packages].sort((left, right) => {
        if (left.package_kind !== right.package_kind) {
          return left.package_kind.localeCompare(right.package_kind);
        }
        if (left.package_name !== right.package_name) {
          return left.package_name.localeCompare(right.package_name);
        }
        return right.version - left.version;
      }),
    [props.packages],
  );

  async function handleCreateDraft() {
    try {
      const manifest = JSON.parse(manifestText) as Record<string, unknown>;
      setManifestError(null);
      await props.onCreateDraft({
        packageName: packageName.trim(),
        packageKind,
        targetScopes,
        manifest,
      });
    } catch (error) {
      setManifestError(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Manifest JSON is invalid.",
      );
    }
  }

  return (
    <article className="admin-governance-panel admin-governance-panel-wide">
      <h3>{isHarnessSurface ? "质量包治理" : "Quality Packages"}</h3>
      <p className="admin-governance-empty">
        {isHarnessSurface
          ? "在这里维护可治理的质量包版本，并将已发布版本绑定到运行绑定和 Harness 对照链路中。"
          : "Maintain governed proofreading and medical analyzer packages here, then bind the published versions into runtime bindings and Harness comparisons."}
      </p>

      <div className="admin-governance-form-grid">
        <label className="admin-governance-field">
          <span>{isHarnessSurface ? "质量包类型" : "Package Kind"}</span>
          <select
            value={packageKind}
            onChange={(event) => {
              const nextKind = event.target.value as ManuscriptQualityPackageKind;
              const previousDefault = defaultManifestText(packageKind);
              const nextDefault = defaultManifestText(nextKind);

              setPackageKind(nextKind);
              setTargetScopes([...defaultTargetScopesByKind[nextKind]]);
              setPackageName(resolveDefaultPackageName(nextKind, props.surface));
              setManifestText((current) =>
                current.trim().length === 0 || current === previousDefault
                  ? nextDefault
                  : current,
              );
            }}
            disabled={props.isMutating}
          >
            <option value="general_style_package">
              {isHarnessSurface ? "通用风格质量包" : "General Style Package"}
            </option>
            <option value="medical_analyzer_package">
              {isHarnessSurface ? "医学分析质量包" : "Medical Analyzer Package"}
            </option>
          </select>
        </label>

        <label className="admin-governance-field">
          <span>{isHarnessSurface ? "质量包名称" : "Package Name"}</span>
          <input
            type="text"
            value={packageName}
            onChange={(event) => setPackageName(event.target.value)}
            disabled={props.isMutating}
          />
        </label>
      </div>

      <fieldset className="admin-governance-module-selector">
        <legend>{isHarnessSurface ? "目标范围" : "Target Scopes"}</legend>
        <div className="admin-governance-module-options">
          {defaultTargetScopesByKind[packageKind].map((scope) => (
            <label key={scope} className="admin-governance-module-option">
              <input
                type="checkbox"
                checked={targetScopes.includes(scope)}
                onChange={() =>
                  setTargetScopes((current) =>
                    current.includes(scope)
                      ? current.filter((value) => value !== scope)
                      : [...current, scope],
                  )
                }
                disabled={props.isMutating}
              />
              <span>{isHarnessSurface ? formatTargetScopeLabel(scope) : scope}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="admin-governance-field">
        <span>{isHarnessSurface ? "质量包清单" : "Package Manifest"}</span>
        {packageKind === "general_style_package" ? (
          <>
            {parsedManifestState.manifest ? (
              <GeneralStylePackageEditor
                surface={props.surface}
                manifest={parsedManifestState.manifest}
                onChange={(nextManifest) => {
                  setManifestText(JSON.stringify(nextManifest, null, 2));
                  setManifestError(null);
                }}
                disabled={props.isMutating}
              />
            ) : (
              <p className="admin-governance-error">
                {isHarnessSurface
                  ? "原始 JSON 恢复有效前，结构化编辑器暂不可用。"
                  : "Structured editor is temporarily unavailable until the raw JSON is valid again."}
              </p>
            )}
            <details>
              <summary>{isHarnessSurface ? "高级 JSON" : "Advanced JSON"}</summary>
              <textarea
                value={manifestText}
                onChange={(event) => setManifestText(event.target.value)}
                rows={14}
                disabled={props.isMutating}
              />
            </details>
          </>
        ) : (
          <>
            {parsedManifestState.manifest ? (
              <MedicalAnalyzerPackageEditor
                manifest={parsedManifestState.manifest}
                onChange={(nextManifest) => {
                  setManifestText(JSON.stringify(nextManifest, null, 2));
                  setManifestError(null);
                }}
                disabled={props.isMutating}
              />
            ) : (
              <p className="admin-governance-error">
                {isHarnessSurface
                  ? "原始 JSON 恢复有效前，结构化编辑器暂不可用。"
                  : "Structured editor is temporarily unavailable until the raw JSON is valid again."}
              </p>
            )}
            <details>
              <summary>{isHarnessSurface ? "高级 JSON" : "Advanced JSON"}</summary>
              <textarea
                value={manifestText}
                onChange={(event) => setManifestText(event.target.value)}
                rows={14}
                disabled={props.isMutating}
              />
            </details>
          </>
        )}
      </label>

      {manifestError ?? parsedManifestState.error ? (
        <p className="admin-governance-error">
          {manifestError ?? parsedManifestState.error}
        </p>
      ) : null}

      <div className="auth-actions">
        <button
          type="button"
          className="auth-primary-action"
          onClick={() => void handleCreateDraft()}
          disabled={
            props.isMutating ||
            packageName.trim().length === 0 ||
            targetScopes.length === 0 ||
            manifestText.trim().length === 0
          }
        >
          {isHarnessSurface ? "创建草稿质量包版本" : "Create Draft Package Version"}
        </button>
      </div>

      {sortedPackages.length > 0 ? (
        <ul className="admin-governance-list admin-governance-list-spaced">
          {sortedPackages.map((record) => (
            <li key={record.id} className="admin-governance-template-row">
              <div>
                <strong>
                  {record.package_name} / v{record.version}
                </strong>
                <p>
                  {formatPackageKind(record.package_kind, props.surface)} /{" "}
                  {Array.isArray(record.target_scopes)
                    ? record.target_scopes.join(", ")
                    : props.surface === "harness"
                      ? "范围未记录"
                      : "scope unavailable"}
                </p>
                <details>
                  <summary>{isHarnessSurface ? "清单预览" : "Manifest Preview"}</summary>
                  <pre>{JSON.stringify(record.manifest, null, 2)}</pre>
                </details>
              </div>
              <div className="admin-governance-template-actions">
                <span className="admin-governance-badge">{record.status}</span>
                {record.status === "draft" ? (
                  <button
                    type="button"
                    className="workbench-secondary-action"
                    onClick={() => void props.onPublishVersion(record.id)}
                    disabled={props.isMutating}
                  >
                    {isHarnessSurface ? "发布" : "Publish"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-governance-empty">
          {isHarnessSurface
            ? "当前还没有质量包，请先创建治理草稿。"
            : "No quality packages yet. Create a governed draft package first."}
        </p>
      )}
    </article>
  );
}

function resolveDefaultPackageName(
  kind: ManuscriptQualityPackageKind,
  surface: ManuscriptQualityPackagesSectionProps["surface"] = "default",
): string {
  switch (kind) {
    case "general_style_package":
      return surface === "harness" ? "医学研究通用风格" : "Medical Research Style";
    case "medical_analyzer_package":
      return surface === "harness" ? "医学分析基础包" : "Medical Analyzer Base";
  }
}

function defaultManifestText(kind: ManuscriptQualityPackageKind): string {
  return JSON.stringify(
    kind === "general_style_package"
      ? {
          ...createDefaultGeneralStylePackageManifest(),
        }
      : {
          ...createDefaultMedicalAnalyzerPackageManifest(),
        },
    null,
    2,
  );
}

function formatPackageKind(
  kind: ManuscriptQualityPackageViewModel["package_kind"],
  surface: ManuscriptQualityPackagesSectionProps["surface"] = "default",
): string {
  switch (kind) {
    case "general_style_package":
      return surface === "harness" ? "通用风格" : "General Style";
    case "medical_analyzer_package":
      return surface === "harness" ? "医学分析" : "Medical Analyzer";
  }
}

function formatTargetScopeLabel(
  scope: CreateManuscriptQualityPackageDraftInput["targetScopes"][number],
): string {
  switch (scope) {
    case "general_proofreading":
      return "通用校对";
    case "medical_specialized":
      return "医学专项";
  }
}

function tryParseManifest(text: string): {
  manifest: Record<string, unknown> | null;
  error: string | null;
} {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {
        manifest: null,
        error: "Manifest JSON must be an object.",
      };
    }

    return {
      manifest: parsed as Record<string, unknown>,
      error: null,
    };
  } catch (error) {
    return {
      manifest: null,
      error:
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Manifest JSON is invalid.",
    };
  }
}
