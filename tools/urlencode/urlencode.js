#!/usr/bin/env node

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1murlencode\x1b[0m - URL encode/decode utility

  \x1b[1mUsage:\x1b[0m
    urlencode encode <string>
    urlencode decode <string>
    urlencode encode-uri <url>
    urlencode decode-uri <url>
    urlencode params <url>
    urlencode build <base> [key=value...]

  \x1b[1mCommands:\x1b[0m
    encode <string>       Encode URL component
    decode <string>       Decode URL component
    encode-uri <url>      Encode full URL
    decode-uri <url>      Decode full URL
    params <url>          Parse URL parameters
    build <base> [k=v...] Build URL with parameters

  \x1b[1mOptions:\x1b[0m
    -c, --component     Encode as URL component (default)
    -f, --full          Encode as full URL
    -p, --parse         Parse URL
    -h, --help          Show this help

  \x1b[1mExamples:\x1b[0m
    urlencode encode "hello world"
    urlencode decode "hello%20world"
    urlencode encode-uri "https://example.com/path?name=hello world"
    urlencode params "https://example.com?name=John&age=30"
    urlencode build "https://example.com" name=John age=30
`);
}

// --- Encode URL component ---
function encodeComponent(str) {
  return encodeURIComponent(str);
}

// --- Decode URL component ---
function decodeComponent(str) {
  try {
    return decodeURIComponent(str);
  } catch (err) {
    throw new Error(`Invalid encoded string: ${str}`);
  }
}

// --- Encode full URL ---
function encodeUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.href;
  } catch {
    // If not a valid URL, encode as component
    return encodeComponent(url);
  }
}

// --- Decode full URL ---
function decodeUrl(url) {
  return decodeComponent(url);
}

// --- Parse URL parameters ---
function parseParams(url) {
  try {
    const parsed = new URL(url);
    const params = {};

    for (const [key, value] of parsed.searchParams) {
      if (params[key]) {
        if (!Array.isArray(params[key])) {
          params[key] = [params[key]];
        }
        params[key].push(value);
      } else {
        params[key] = value;
      }
    }

    return {
      protocol: parsed.protocol,
      host: parsed.host,
      pathname: parsed.pathname,
      params,
    };
  } catch (err) {
    throw new Error(`Invalid URL: ${url}`);
  }
}

// --- Build URL with parameters ---
function buildUrl(base, params) {
  try {
    const url = new URL(base);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }

    return url.href;
  } catch (err) {
    throw new Error(`Invalid base URL: ${base}`);
  }
}

// --- Display results ---
function displayResult(result, verbose = false) {
  if (typeof result === 'string') {
    console.log(result);
  } else if (typeof result === 'object') {
    if (verbose) {
      console.log();
      for (const [key, value] of Object.entries(result)) {
        if (typeof value === 'object') {
          console.log(`  ${C.bold}${key}:${C.reset}`);
          for (const [k, v] of Object.entries(value)) {
            console.log(`    ${k}: ${v}`);
          }
        } else {
          console.log(`  ${C.bold}${key}:${C.reset} ${value}`);
        }
      }
      console.log();
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  }
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let command = null;
  let verbose = false;
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-v' || arg === '--verbose') {
      verbose = true;
    } else if (!arg.startsWith('-')) {
      if (!command) {
        command = arg;
      } else {
        positional.push(arg);
      }
    }
  }

  return { command, verbose, positional };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  if (!opts.command) {
    showHelp();
    process.exit(1);
  }

  try {
    switch (opts.command) {
      case 'encode':
      case 'enc':
        if (opts.positional.length < 1) {
          console.error(`  ${C.red}Error:${C.reset} Usage: urlencode encode <string>`);
          process.exit(1);
        }
        displayResult(encodeComponent(opts.positional.join(' ')));
        break;

      case 'decode':
      case 'dec':
        if (opts.positional.length < 1) {
          console.error(`  ${C.red}Error:${C.reset} Usage: urlencode decode <string>`);
          process.exit(1);
        }
        displayResult(decodeComponent(opts.positional.join(' ')));
        break;

      case 'encode-uri':
      case 'enc-uri':
        if (opts.positional.length < 1) {
          console.error(`  ${C.red}Error:${C.reset} Usage: urlencode encode-uri <url>`);
          process.exit(1);
        }
        displayResult(encodeUrl(opts.positional.join(' ')));
        break;

      case 'decode-uri':
      case 'dec-uri':
        if (opts.positional.length < 1) {
          console.error(`  ${C.red}Error:${C.reset} Usage: urlencode decode-uri <url>`);
          process.exit(1);
        }
        displayResult(decodeUrl(opts.positional.join(' ')));
        break;

      case 'params':
      case 'parse':
        if (opts.positional.length < 1) {
          console.error(`  ${C.red}Error:${C.reset} Usage: urlencode params <url>`);
          process.exit(1);
        }
        const parsed = parseParams(opts.positional.join(' '));
        displayResult(parsed, opts.verbose);
        break;

      case 'build':
        if (opts.positional.length < 1) {
          console.error(`  ${C.red}Error:${C.reset} Usage: urlencode build <base> [key=value...]`);
          process.exit(1);
        }
        const base = opts.positional[0];
        const params = {};
        for (let i = 1; i < opts.positional.length; i++) {
          const [key, ...valueParts] = opts.positional[i].split('=');
          params[key] = valueParts.join('=');
        }
        displayResult(buildUrl(base, params));
        break;

      default:
        console.error(`  ${C.red}Error:${C.reset} Unknown command: ${opts.command}`);
        showHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
