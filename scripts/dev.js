const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

console.log('\x1b[36m%s\x1b[0m', '=====================================================');
console.log('\x1b[36m%s\x1b[0m', ' Starting Durozen Leave Management System (Dev Mode)');
console.log('\x1b[36m%s\x1b[0m', ' Frontend: http://localhost:3000');
console.log('\x1b[36m%s\x1b[0m', ' Backend API: http://localhost:4000/api');
console.log('\x1b[36m%s\x1b[0m', '=====================================================\n');

function runProcess(name, color, command, args, cwd) {
  const proc = spawn(command, args, {
    cwd,
    shell: true,
    env: { ...process.env, FORCE_COLOR: 'true' },
  });

  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim()) {
        console.log(`${prefix}${line}`);
      }
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim()) {
        console.error(`${prefix}\x1b[31m${line}\x1b[0m`);
      }
    });
  });

  proc.on('close', (code) => {
    console.log(`${prefix}Process exited with code ${code}`);
  });

  return proc;
}

// 1. Start Backend (NestJS API on port 4000)
const backend = runProcess(
  'BACKEND',
  '34', // Blue
  'node',
  ['dist/src/main.js'],
  path.join(rootDir, 'backend')
);

// 2. Start Frontend (Next.js on port 3000)
const frontend = runProcess(
  'FRONTEND',
  '32', // Green
  npxCmd,
  ['next', 'start', '-p', '3000'],
  path.join(rootDir, 'frontend')
);

// Handle clean exit on Ctrl+C
function cleanup() {
  console.log('\n\x1b[33m%s\x1b[0m', 'Shutting down services...');
  if (backend) backend.kill();
  if (frontend) frontend.kill();
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
