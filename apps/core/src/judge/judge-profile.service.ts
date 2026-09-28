import { readFile } from 'node:fs/promises';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { installProfile } from '../agent/profile-install.js';
import {
  CHOIR_CONFIG,
  type ChoirConfig,
  DEFAULT_JUDGE_CONTEXT,
  JUDGE_INSTRUCTIONS,
  JUDGE_PROFILE_TEMPLATE,
  judgeContext,
  judgeFolder,
  judgeProfileDir,
} from '../choir/choir-config.js';

@Injectable()
export class JudgeProfileService implements OnModuleInit {
  constructor(@Inject(CHOIR_CONFIG) private readonly config: ChoirConfig) {}

  onModuleInit(): Promise<void> {
    return installProfile({
      template: JUDGE_PROFILE_TEMPLATE,
      dir: judgeProfileDir(this.config),
      editable: { from: DEFAULT_JUDGE_CONTEXT, to: judgeContext(this.config) },
      folder: judgeFolder(this.config),
    });
  }

  async systemPrompt(): Promise<string> {
    const [instructions, context] = await Promise.all([
      readFile(JUDGE_INSTRUCTIONS, 'utf8'),
      readFile(judgeContext(this.config), 'utf8'),
    ]);
    return `${instructions}\n${context}`;
  }
}
