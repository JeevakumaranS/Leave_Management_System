import 'dotenv/config';
import { EmployeeStatus, Prisma, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as readline from 'node:readline';
import { stdin, stdout } from 'node:process';

const prisma = new PrismaClient();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    return (await new Promise<string>((resolve) => rl.question(question, resolve))).trim();
  } finally {
    rl.close();
  }
}

function askHidden(question: string): Promise<string> {
  if (!stdin.isTTY) {
    return Promise.reject(new Error('Run this command in an interactive terminal to enter the password securely.'));
  }

  return new Promise((resolve, reject) => {
    const wasRaw = stdin.isRaw;
    let value = '';

    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
      stdout.write('\n');
    };

    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') {
          cleanup();
          reject(new Error('Input cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          if (value.length > 0) {
            value = Array.from(value).slice(0, -1).join('');
            stdout.write('\b \b');
          }
          continue;
        }
        if (character >= ' ') {
          value += character;
          stdout.write('*');
        }
      }
    };

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Configure backend/.env before running this command.');
  }

  const name = await ask('Director full name: ');
  const employeeId = (await ask('Employee ID: ')).toUpperCase();
  const email = (await ask('Email: ')).toLowerCase();
  const department = (await ask('Department [Executive Management]: ')) || 'Executive Management';
  const designation = (await ask('Designation [Director]: ')) || 'Director';

  if (!name || !employeeId || !email) {
    throw new Error('Name, employee ID, and email are required.');
  }
  if (!emailPattern.test(email)) {
    throw new Error('Enter a valid email address.');
  }

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ employeeId }, { email }] },
    select: { id: true },
  });
  if (existingUser) {
    throw new Error('A user with this employee ID or email already exists.');
  }

  const password = await askHidden('Password (hidden): ');
  if (Array.from(password).length < 12) {
    throw new Error('Password must be at least 12 characters long.');
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Password must be no more than 72 bytes for bcrypt.');
  }
  const passwordConfirmation = await askHidden('Confirm password (hidden): ');
  if (password !== passwordConfirmation) {
    throw new Error('Passwords do not match.');
  }

  console.log('\nDirector account to create:');
  console.log(`  Name: ${name}`);
  console.log(`  Employee ID: ${employeeId}`);
  console.log(`  Email: ${email}`);
  console.log(`  Department: ${department}`);
  console.log(`  Designation: ${designation}`);
  if (!['y', 'yes'].includes((await ask('Create this account? (y/N): ')).toLowerCase())) {
    console.log('Creation cancelled; no user was added.');
    return;
  }

  const user = await prisma.user.create({
    data: {
      name,
      employeeId,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: Role.DIRECTOR,
      status: EmployeeStatus.ACTIVE,
      department,
      designation,
    },
    select: { employeeId: true, email: true, name: true, role: true },
  });

  console.log(`Created active ${user.role} account for ${user.name} (${user.employeeId}, ${user.email}).`);
  console.log('The Director can sign in with their email or employee ID.');
}

function errorMessage(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return 'A user with this employee ID or email already exists.';
  }
  return error instanceof Error ? error.message : 'Unknown error.';
}

main()
  .catch((error: unknown) => {
    console.error(`Director creation failed: ${errorMessage(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
