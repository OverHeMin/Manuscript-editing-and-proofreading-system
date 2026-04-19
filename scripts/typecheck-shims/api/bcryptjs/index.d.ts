declare module "bcryptjs" {
  export interface BcryptJsApi {
    hash(value: string, saltOrRounds: number | string): Promise<string>;
    compare(value: string, encrypted: string): Promise<boolean>;
  }

  const bcrypt: BcryptJsApi;

  export function hash(value: string, saltOrRounds: number | string): Promise<string>;
  export function compare(value: string, encrypted: string): Promise<boolean>;
  export default bcrypt;
}
