import { Global, Module } from '@nestjs/common';
import { choirConfigProvider } from './choir-config.provider.js';

@Global()
@Module({
  providers: [choirConfigProvider],
  exports: [choirConfigProvider.provide],
})
export class ChoirModule {}
