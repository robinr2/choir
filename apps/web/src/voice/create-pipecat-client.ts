import { PipecatClient } from '@pipecat-ai/client-js';
import { SmallWebRTCTransport } from '@pipecat-ai/small-webrtc-transport';

export function createPipecatClient(): PipecatClient {
  return new PipecatClient({ transport: new SmallWebRTCTransport() });
}
