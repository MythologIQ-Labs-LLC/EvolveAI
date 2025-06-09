
// src/logger.ts
import fs from 'fs';
import path from 'path';

const logFile = path.join(__dirname, '../logs/evolveai.log');

export function log(message: string) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFile, entry, 'utf8');
}
