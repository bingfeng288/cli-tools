export async function time(args) {
  const now = new Date();
  const sub = args[0];

  if (sub === 'unix' || sub === 'ts') {
    console.log(`\n  Unix: ${Math.floor(now.getTime() / 1000)}`);
    console.log(`  Milliseconds: ${now.getTime()}\n`);
    return;
  }

  if (sub === 'parse') {
    const input = args[1];
    if (!input) { console.error('  Usage: devkit time parse <timestamp|date>'); return; }
    const num = Number(input);
    const d = num > 1e12 ? new Date(num) : num > 1e9 ? new Date(num * 1000) : new Date(input);
    if (isNaN(d.getTime())) { console.error('  Invalid date'); return; }
    console.log(`\n  ISO:     ${d.toISOString()}`);
    console.log(`  Local:   ${d.toLocaleString()}`);
    console.log(`  UTC:     ${d.toUTCString()}`);
    console.log(`  Unix:    ${Math.floor(d.getTime() / 1000)}`);
    console.log(`  Millis:  ${d.getTime()}\n`);
    return;
  }

  // Default: show all formats
  console.log(`\n  ISO:      ${now.toISOString()}`);
  console.log(`  Local:    ${now.toLocaleString()}`);
  console.log(`  UTC:      ${now.toUTCString()}`);
  console.log(`  Unix:     ${Math.floor(now.getTime() / 1000)}`);
  console.log(`  Millis:   ${now.getTime()}`);
  console.log(`  Timezone: Intl.DateTimeFormat().resolvedOptions().timeZone`);
  console.log(`  Offset:   UTC${now.getTimezoneOffset() > 0 ? '-' : '+'}${Math.abs(now.getTimezoneOffset() / 60)}\n`);
}
