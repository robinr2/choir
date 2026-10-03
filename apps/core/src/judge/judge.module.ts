import { Module } from '@nestjs/common';
import { ClaudeJudge } from './claude-judge.js';
import { JUDGE } from './judge.port.js';
import { JudgeProfileService } from './judge-profile.service.js';
import { JudgeQueue } from './judge-queue.js';
import { JudgeQueueStore } from './judge-queue.store.js';

@Module({
  providers: [
    JudgeProfileService,
    { provide: JUDGE, useClass: ClaudeJudge },
    JudgeQueueStore,
    JudgeQueue,
  ],
})
export class JudgeModule {}
