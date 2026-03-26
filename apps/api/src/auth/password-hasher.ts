import bcrypt from "bcryptjs";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, digest: string): Promise<boolean>;
}

export interface BcryptPasswordHasherOptions {
  rounds?: number;
}

export class BcryptPasswordHasher implements PasswordHasher {
  private readonly rounds: number;

  constructor(options: BcryptPasswordHasherOptions = {}) {
    this.rounds = options.rounds ?? 12;
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds);
  }

  verify(password: string, digest: string): Promise<boolean> {
    return bcrypt.compare(password, digest);
  }
}
