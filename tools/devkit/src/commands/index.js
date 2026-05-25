import { commit } from './commit.js';
import { stats } from './stats.js';
import { env } from './env.js';
import { license } from './license.js';
import { serve } from './serve.js';
import { hash } from './hash.js';
import { uuid } from './uuid.js';
import { time } from './time.js';
import { ip } from './ip.js';
import { ports } from './ports.js';
import { json } from './json.js';
import { base64 } from './base64.js';
import { qr } from './qr.js';

export const commands = {
  commit, stats, env, license, serve,
  hash, uuid, time, ip, ports, json, base64, qr,
};
