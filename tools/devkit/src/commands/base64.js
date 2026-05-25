export async function base64(args) {
  const sub = args[0];

  if (sub === 'encode' || sub === 'enc') {
    const input = args.slice(1).join(' ');
    if (!input) { console.error('  Usage: devkit base64 encode <string>'); return; }
    console.log(`\n  ${Buffer.from(input).toString('base64')}\n`);
    return;
  }

  if (sub === 'decode' || sub === 'dec') {
    const input = args.slice(1).join(' ');
    if (!input) { console.error('  Usage: devkit base64 decode <string>'); return; }
    try {
      console.log(`\n  ${Buffer.from(input, 'base64').toString('utf-8')}\n`);
    } catch {
      console.error('  Invalid base64 string');
    }
    return;
  }

  console.log('  Usage: devkit base64 [encode|decode] <string>');
}
