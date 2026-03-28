import type { ToolGatewayToolRecord } from "./tool-gateway-record.ts";

export interface ToolGatewayRepository {
  save(record: ToolGatewayToolRecord): Promise<void>;
  findById(id: string): Promise<ToolGatewayToolRecord | undefined>;
  list(): Promise<ToolGatewayToolRecord[]>;
  listByScope(scope: ToolGatewayToolRecord["scope"]): Promise<ToolGatewayToolRecord[]>;
}
