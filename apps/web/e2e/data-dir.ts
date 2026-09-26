import { tmpdir } from 'node:os';
import path from 'node:path';

export const E2E_DATA_DIR = path.join(tmpdir(), 'choir-e2e');
