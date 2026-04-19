declare module "pg" {
  export interface QueryResult<Row = Record<string, unknown>> {
    rows: Row[];
    rowCount: number | null;
  }

  export interface PoolClient {
    query<Row = Record<string, unknown>>(
      queryText: string,
      values?: readonly unknown[],
    ): Promise<QueryResult<Row>>;
    release(): void;
  }

  export class Client {
    constructor(config?: Record<string, unknown>);
    connect(): Promise<void>;
    end(): Promise<void>;
    query<Row = Record<string, unknown>>(
      queryText: string,
      values?: readonly unknown[],
    ): Promise<QueryResult<Row>>;
  }

  export class Pool {
    constructor(config?: Record<string, unknown>);
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
    query<Row = Record<string, unknown>>(
      queryText: string,
      values?: readonly unknown[],
    ): Promise<QueryResult<Row>>;
  }
}
