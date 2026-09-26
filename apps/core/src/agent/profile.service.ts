import { constants, copyFile, cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  CHOIR_CONFIG,
  type ChoirConfig,
  defaultFolder,
  profileDir,
} from '../choir/choir-config.js';

const APP_ROOT = path.resolve(import.meta.dirname, '..', '..');
const PROFILE_TEMPLATE = path.join(APP_ROOT, 'profile-template');
const VOICE_PROMPT = 'default-voice-prompt.md';

function keepExisting(error: NodeJS.ErrnoException): void {
  if (error.code !== 'EEXIST') throw error;
}

@Injectable()
export class ProfileService implements OnModuleInit {
  constructor(@Inject(CHOIR_CONFIG) private readonly config: ChoirConfig) {}

  async onModuleInit(): Promise<void> {
    const profile = profileDir(this.config);
    await cp(PROFILE_TEMPLATE, profile, {
      recursive: true,
      force: false,
      errorOnExist: false,
    });
    await copyFile(
      path.join(APP_ROOT, VOICE_PROMPT),
      path.join(profile, VOICE_PROMPT),
      constants.COPYFILE_EXCL,
    ).catch(keepExisting);
    await mkdir(defaultFolder(this.config), { recursive: true });
  }
}
