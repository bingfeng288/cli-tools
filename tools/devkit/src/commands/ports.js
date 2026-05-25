import { execSync } from 'node:child_process';

export async function ports(args) {
  const portArg = args[0];

  try {
    let cmd;
    if (portArg) {
      cmd = `lsof -i :${portArg} -P -n 2>/dev/null`;
    } else {
      cmd = `lsof -i -P -n 2>/dev/null | grep LISTEN`;
    }

    const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });

    if (!output.trim()) {
      console.log(`\n  No processes listening${portArg ? ` on port ${portArg}` : ''}.\n`);
      return;
    }

    console.log(`\n  Ports in use${portArg ? ` (port ${portArg})` : ''}:\n`);
    const lines = output.trim().split('\n');

    // Parse and format
    const header = `  ${'COMMAND'.padEnd(20)} ${'PID'.padEnd(8)} ${'USER'.padEnd(12)} ${'PROTOCOL'.padEnd(6)} ${'PORT'.padEnd(8)} ${'STATE'.padEnd(10)}`;
    console.log(header);
    console.log('  ' + '-'.repeat(header.length - 2));

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 9) continue;
      const [, command, pid, user,,, proto, , name] = parts;
      const port = name?.match(/:(\d+)/)?.[1] || '?';
      console.log(`  ${command.slice(0, 19).padEnd(20)} ${pid.padEnd(8)} ${user.slice(0, 11).padEnd(12)} ${proto.padEnd(6)} ${port.padEnd(8)} LISTEN`);
    }
    console.log();
  } catch {
    console.log(`\n  No processes listening${portArg ? ` on port ${portArg}` : ''}.\n`);
  }
}
