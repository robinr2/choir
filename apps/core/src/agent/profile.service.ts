import { constants, copyFile, cp, mkdir, readFile } from 'node:fs/promises';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  CHOIR_CONFIG,
  type ChoirConfig,
  DEFAULT_VOICE_PROMPT,
  defaultFolder,
  PROFILE_TEMPLATE,
  profileDir,
  profileVoicePrompt,
} from '../choir/choir-config.js';

function keepExisting(error: NodeJS.ErrnoException): void {
  if (error.code !== 'EEXIST') throw error;
}

@Injectable()
export class ProfileService implements OnModuleInit {
  constructor(@Inject(CHOIR_CONFIG) private readonly config: ChoirConfig) {}

  async onModuleInit(): Promise<void> {
    await cp(PROFILE_TEMPLATE, profileDir(this.config), {
      recursive: true,
      force: false,
      errorOnExist: false,
    });
    await copyFile(
      DEFAULT_VOICE_PROMPT,
      profileVoicePrompt(this.config),
      constants.COPYFILE_EXCL,
    ).catch(keepExisting);
    await mkdir(defaultFolder(this.config), { recursive: true });
  }

  voicePrompt(): Promise<string> {
    return readFile(profileVoicePrompt(this.config), 'utf8');
  }
}
