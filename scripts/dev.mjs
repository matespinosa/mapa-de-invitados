import { spawn } from 'node:child_process';

// Vite documents --host, while Vinext exposes the equivalent as --hostname.
// Keep the familiar npm command working and preserve an optional host value.
const rawArgs = process.argv.slice(2);
const forwarded = [];
for (let index = 0; index < rawArgs.length; index += 1) {
  const arg = rawArgs[index];
  if (arg === '--host') {
    const next = rawArgs[index + 1];
    if (next && !next.startsWith('-')) {
      forwarded.push('--hostname', next);
      index += 1;
    } else {
      forwarded.push('--hostname', '0.0.0.0');
    }
  } else if (arg.startsWith('--host=')) {
    forwarded.push('--hostname', arg.slice('--host='.length) || '0.0.0.0');
  } else {
    forwarded.push(arg);
  }
}

const child = spawn('vinext', ['dev', ...forwarded], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
