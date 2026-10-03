import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import postgres from '@prisma/orm-postgres/runtime';
import { CHOIR_CONFIG, type ChoirConfig } from '../choir/choir-config.js';
import type { Contract } from '../prisma/contract.js';
import contractJson from '../prisma/contract.json' with { type: 'json' };

function connect(url: string) {
  return postgres<Contract>({ contractJson, url });
}

export type Database = ReturnType<typeof connect>;

export type Orm = Database['orm']['public'];

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly client: Database;

  constructor(@Inject(CHOIR_CONFIG) config: ChoirConfig) {
    this.client = connect(config.databaseUrl);
  }

  get orm(): Orm {
    return this.client.orm.public;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}
