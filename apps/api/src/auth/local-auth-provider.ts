import type { AuthSession, AuthService, LoginInput } from "./auth-service.ts";
import type { AuthProviderName } from "./provider.ts";

export interface AuthenticationProvider {
  readonly name: AuthProviderName;
  authenticate(input: LoginInput): Promise<AuthSession>;
}

export class LocalAuthenticationProvider implements AuthenticationProvider {
  readonly name = "local" as const;

  constructor(private readonly authService: AuthService) {}

  authenticate(input: LoginInput): Promise<AuthSession> {
    return this.authService.login(input, this.name);
  }
}
