import {
  BrowserHttpClientError,
} from "../../lib/browser-http-client.ts";

interface WorkbenchErrorResponseBody {
  error?: unknown;
  code?: unknown;
  message?: unknown;
}

export function formatWorkbenchRequestError(error: unknown): string {
  if (error instanceof BrowserHttpClientError) {
    const responseBody = asWorkbenchErrorResponseBody(error.responseBody);
    if (
      responseBody?.error === "ai_provider_configuration_error" &&
      typeof responseBody.code === "string"
    ) {
      return formatAiProviderConfigurationError(responseBody.code);
    }

    if (isTemplateFamilyRequiredError(responseBody)) {
      return "当前稿件还没有应用模板，请先在工作台选择并应用模板后，再点击执行。";
    }

    if (typeof responseBody?.message === "string" && responseBody.message.trim()) {
      return responseBody.message;
    }

    return `${error.message}: ${JSON.stringify(error.responseBody)}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown workbench error";
}

function asWorkbenchErrorResponseBody(
  value: unknown,
): WorkbenchErrorResponseBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as WorkbenchErrorResponseBody;
}

function isTemplateFamilyRequiredError(
  responseBody: WorkbenchErrorResponseBody | null,
): boolean {
  return (
    responseBody?.error === "manuscript_template_not_configured" ||
    responseBody?.code === "template_family_required"
  );
}

function formatAiProviderConfigurationError(code: string): string {
  switch (code) {
    case "credential_invalid":
      return "AI 提供商凭据无效，请到系统设置重新轮换该连接的 API Key 后再试。";
    case "credential_missing":
      return "AI 提供商尚未配置凭据，请先在系统设置补全 API Key 后再试。";
    case "connection_disabled":
      return "AI 提供商连接已被禁用，请先在系统设置启用后再试。";
    case "connection_missing":
      return "AI 提供商连接不存在，请先在系统设置重新绑定模型连接后再试。";
    case "unsupported_adapter":
      return "AI 提供商连接的兼容模式暂不受支持，请检查系统设置后再试。";
    case "legacy_unbound":
      return "当前模型还没有完成 AI 提供商绑定，请先检查系统设置后再试。";
    default:
      return "AI 提供商当前不可用，请检查系统设置中的模型连接与凭据后再试。";
  }
}
