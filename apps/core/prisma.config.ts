import 'dotenv/config';
import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';
import { choirConfigFrom } from './src/choir/choir-config.js';

export default definePrismaConfig({
  orm: ormConfig({
    contract: './src/prisma/contract.prisma',
    db: {
      connection: choirConfigFrom(process.env).databaseUrl,
    },
  }),
  skills: {
    agents: ['claude'],
  },
});
