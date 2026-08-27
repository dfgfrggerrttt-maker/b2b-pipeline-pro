import { config } from "../config.ts";

export interface DatabaseAdapter {
  connect(): Promise<void>;
  getAll<T>(table: string): Promise<T[]>;
  getById<T>(table: string, id: string): Promise<T | undefined>;
  insert<T>(table: string, data: T): Promise<T>;
  update<T>(table: string, id: string, data: Partial<T>): Promise<T | undefined>;
  delete(table: string, id: string): Promise<boolean>;
  find<T>(table: string, predicate: (item: T) => boolean): Promise<T[]>;
}

export class MockAdapter implements DatabaseAdapter {
  private memory: Record<string, any[]> = {};

  async connect() { 
    console.log("🗄️ Connected to Mock DB (In-Memory)"); 
  }

  async getAll<T>(table: string): Promise<T[]> { 
    return this.memory[table] || []; 
  }

  async getById<T>(table: string, id: string): Promise<T | undefined> {
    const items = this.memory[table] || [];
    return items.find((item: any) => item.id === id);
  }

  async insert<T>(table: string, data: T): Promise<T> {
    if (!this.memory[table]) this.memory[table] = [];
    const item: any = { 
      ...data, 
      id: crypto.randomUUID(), 
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.memory[table].push(item);
    return item as T;
  }

  async update<T>(table: string, id: string, data: Partial<T>): Promise<T | undefined> {
    const items = this.memory[table] || [];
    const index = items.findIndex((item: any) => item.id === id);
    if (index === -1) return undefined;
    items[index] = { 
      ...items[index], 
      ...data, 
      updated_at: new Date().toISOString() 
    };
    return items[index] as T;
  }

  async delete(table: string, id: string): Promise<boolean> {
    const items = this.memory[table] || [];
    const index = items.findIndex((item: any) => item.id === id);
    if (index === -1) return false;
    items.splice(index, 1);
    return true;
  }

  async find<T>(table: string, predicate: (item: T) => boolean): Promise<T[]> {
    const items = this.memory[table] || [];
    return items.filter(predicate);
  }
}

export class PostgreSQLAdapter implements DatabaseAdapter {
  async connect() { console.log("🗄️ Connected to PostgreSQL"); }
  async getAll<T>(): Promise<T[]> { return []; }
  async getById<T>(): Promise<T | undefined> { return undefined; }
  async insert<T>(table: string, data: T): Promise<T> { return data; }
  async update<T>(): Promise<T | undefined> { return undefined; }
  async delete(): Promise<boolean> { return false; }
  async find<T>(): Promise<T[]> { return []; }
}

export const dbAdapter: DatabaseAdapter = config.dbUrl === "mock" ? new MockAdapter() : new PostgreSQLAdapter();
await dbAdapter.connect();
