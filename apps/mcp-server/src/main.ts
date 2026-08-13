#!/usr/bin/env node
import { run } from './run.js';

process.exitCode = await run(process.argv.slice(2), {
  input: process.stdin,
  output: process.stdout,
  stderr: (line) => process.stderr.write(`${line}\n`),
  env: process.env,
});
