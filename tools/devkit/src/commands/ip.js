import { networkInterfaces } from 'node:os';
import { get } from 'node:http';

export async function ip(args) {
  console.log('\n  Local addresses:\n');
  const nets = networkInterfaces();
  for (const [name, addrs] of Object.entries(nets)) {
    for (const addr of addrs) {
      if (addr.internal) continue;
      const family = addr.family === 'IPv4' ? 'IPv4' : 'IPv6';
      console.log(`    ${name.padEnd(16)} ${family.padEnd(6)} ${addr.address}`);
    }
  }

  // Try to get public IP
  console.log('\n  Public IP:');
  try {
    const pubIp = await new Promise((resolve, reject) => {
      get('http://ip-api.com/json/', res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch { reject(new Error('parse error')); }
        });
      }).on('error', reject);
    });
    console.log(`    IP:       ${pubIp.query}`);
    console.log(`    Location: ${pubIp.city}, ${pubIp.regionName}, ${pubIp.country}`);
    console.log(`    ISP:      ${pubIp.isp}`);
  } catch {
    console.log('    (Could not fetch public IP)');
  }
  console.log();
}
