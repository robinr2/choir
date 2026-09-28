import { readFile } from 'node:fs/promises';
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
import { installProfile } from './profile-install.js';

@Injectable()
export class ProfileService implements OnModuleInit {
  constructor(@Inject(CHOIR_CONFIG) private readonly config: ChoirConfig) {}

  onModuleInit(): Promise<void> {
    return installProfile({
      template: PROFILE_TEMPLATE,
      dir: profileDir(this.config),
      editable: {
        from: DEFAULT_VOICE_PROMPT,
        to: profileVoicePrompt(this.config),
      },
      folder: defaultFolder(this.config),
    });
  }

  voicePrompt(): Promise<string> {
    return readFile(profileVoicePrompt(this.config), 'utf8');
  }
}
