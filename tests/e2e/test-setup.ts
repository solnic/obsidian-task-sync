/**
 * Test setup file for e2e tests
 * Ensures necessary directories exist and configures test environment
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";

const _result = config();

const debugDir = path.join(process.cwd(), "e2e", "debug");

const cleanupOldFiles = (dir: string, maxFiles: number = 50) => {
  if (!fs.existsSync(dir)) return;

  const files = fs
    .readdirSync(dir)
    .map((file) => ({
      name: file,
      path: path.join(dir, file),
      mtime: fs.statSync(path.join(dir, file)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  // Remove files beyond the limit
  files.slice(maxFiles).forEach((file) => {
    try {
      if (fs.statSync(file.path).isDirectory()) {
        fs.rmSync(file.path, { recursive: true });
      } else {
        fs.unlinkSync(file.path);
      }
    } catch (error) {}
  });
};

cleanupOldFiles(debugDir);
