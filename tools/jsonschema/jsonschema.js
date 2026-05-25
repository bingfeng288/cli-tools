#!/usr/bin/env node

import { readFileSync } from 'node:fs';

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
  \x1b[1mjsonschema\x1b[0m - JSON Schema validator

  \x1b[1mUsage:\x1b[0m
    jsonschema <schema> <data>
    jsonschema <schema> --stdin
    cat data.json | jsonschema <schema>

  \x1b[1mOptions:\x1b[0m
    --stdin             Read data from stdin
    --verbose, -v       Show detailed validation errors
    --quiet, -q         Only show pass/fail status
    --format <fmt>      Output format: text, json (default: text)
    -h, --help          Show this help

  \x1b[1mSupported Schema Types:\x1b[0m
    string, number, integer, boolean, array, object, null

  \x1b[1mSupported Keywords:\x1b[0m
    type, properties, required, items, minimum, maximum
    minLength, maxLength, pattern, enum, const
    additionalProperties, uniqueItems, minItems, maxItems

  \x1b[1mExamples:\x1b[0m
    jsonschema schema.json data.json
    jsonschema schema.json --stdin < data.json
    cat data.json | jsonschema schema.json
    jsonschema schema.json data.json -v
`);
}

// --- Validate against schema ---
function validate(data, schema, path = '') {
  const errors = [];

  // Type validation
  if (schema.type) {
    const type = getType(data);
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];

    // Integer should also match 'number' type
    const isValidType = expectedTypes.includes(type) || (type === 'integer' && expectedTypes.includes('number'));

    if (!isValidType) {
      errors.push({
        path: path || '/',
        message: `Expected type ${expectedTypes.join(' or ')}, got ${type}`,
      });
      return errors; // Skip further validation if type is wrong
    }
  }

  // String validations
  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push({
        path: path || '/',
        message: `String length ${data.length} is less than minimum ${schema.minLength}`,
      });
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push({
        path: path || '/',
        message: `String length ${data.length} is greater than maximum ${schema.maxLength}`,
      });
    }
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(data)) {
        errors.push({
          path: path || '/',
          message: `String does not match pattern: ${schema.pattern}`,
        });
      }
    }
  }

  // Number validations
  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({
        path: path || '/',
        message: `Value ${data} is less than minimum ${schema.minimum}`,
      });
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({
        path: path || '/',
        message: `Value ${data} is greater than maximum ${schema.maximum}`,
      });
    }
    if (schema.exclusiveMinimum !== undefined && data <= schema.exclusiveMinimum) {
      errors.push({
        path: path || '/',
        message: `Value ${data} is not greater than exclusive minimum ${schema.exclusiveMinimum}`,
      });
    }
    if (schema.exclusiveMaximum !== undefined && data >= schema.exclusiveMaximum) {
      errors.push({
        path: path || '/',
        message: `Value ${data} is not less than exclusive maximum ${schema.exclusiveMaximum}`,
      });
    }
    if (schema.multipleOf !== undefined && data % schema.multipleOf !== 0) {
      errors.push({
        path: path || '/',
        message: `Value ${data} is not a multiple of ${schema.multipleOf}`,
      });
    }
  }

  // Enum validation
  if (schema.enum) {
    if (!schema.enum.includes(data)) {
      errors.push({
        path: path || '/',
        message: `Value must be one of: ${schema.enum.map(v => JSON.stringify(v)).join(', ')}`,
      });
    }
  }

  // Const validation
  if (schema.const !== undefined) {
    if (JSON.stringify(data) !== JSON.stringify(schema.const)) {
      errors.push({
        path: path || '/',
        message: `Value must be ${JSON.stringify(schema.const)}`,
      });
    }
  }

  // Array validations
  if (Array.isArray(data)) {
    if (schema.items) {
      for (let i = 0; i < data.length; i++) {
        const itemPath = `${path}/${i}`;
        errors.push(...validate(data[i], schema.items, itemPath));
      }
    }
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push({
        path: path || '/',
        message: `Array length ${data.length} is less than minimum ${schema.minItems}`,
      });
    }
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      errors.push({
        path: path || '/',
        message: `Array length ${data.length} is greater than maximum ${schema.maxItems}`,
      });
    }
    if (schema.uniqueItems) {
      const seen = new Set();
      for (let i = 0; i < data.length; i++) {
        const key = JSON.stringify(data[i]);
        if (seen.has(key)) {
          errors.push({
            path: `${path}/${i}`,
            message: `Duplicate item at index ${i}`,
          });
        }
        seen.add(key);
      }
    }
  }

  // Object validations
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in data)) {
          errors.push({
            path: path || '/',
            message: `Missing required property: ${key}`,
          });
        }
      }
    }
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in data) {
          const propPath = path ? `${path}/${key}` : key;
          errors.push(...validate(data[key], propSchema, propPath));
        }
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties || {}));
      for (const key of Object.keys(data)) {
        if (!allowed.has(key)) {
          errors.push({
            path: path ? `${path}/${key}` : key,
            message: `Additional property not allowed: ${key}`,
          });
        }
      }
    }
    if (schema.minProperties !== undefined && Object.keys(data).length < schema.minProperties) {
      errors.push({
        path: path || '/',
        message: `Object has ${Object.keys(data).length} properties, minimum is ${schema.minProperties}`,
      });
    }
    if (schema.maxProperties !== undefined && Object.keys(data).length > schema.maxProperties) {
      errors.push({
        path: path || '/',
        message: `Object has ${Object.keys(data).length} properties, maximum is ${schema.maxProperties}`,
      });
    }
  }

  return errors;
}

// --- Get type ---
function getType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number' && Number.isInteger(value)) return 'integer';
  return typeof value;
}

// --- Display results ---
function displayResults(errors, options = {}) {
  const { verbose = false, quiet = false, format = 'text' } = options;

  if (format === 'json') {
    console.log(JSON.stringify({
      valid: errors.length === 0,
      errors: errors.map(e => ({
        path: e.path,
        message: e.message,
      })),
    }, null, 2));
    return;
  }

  if (errors.length === 0) {
    if (!quiet) {
      console.log(`\n  ${C.green}✓${C.reset} Validation passed\n`);
    }
    process.exit(0);
  } else {
    if (quiet) {
      process.exit(1);
    }

    console.log(`\n  ${C.red}✗${C.reset} Validation failed: ${errors.length} error${errors.length !== 1 ? 's' : ''}\n`);

    if (verbose) {
      for (const error of errors) {
        console.log(`  ${C.red}•${C.reset} ${C.bold}${error.path}${C.reset}`);
        console.log(`    ${error.message}`);
      }
      console.log();
    }

    process.exit(1);
  }
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let schemaFile = null;
  let dataFile = null;
  let useStdin = false;
  let verbose = false;
  let quiet = false;
  let format = 'text';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--stdin') {
      useStdin = true;
    } else if (arg === '-v' || arg === '--verbose') {
      verbose = true;
    } else if (arg === '-q' || arg === '--quiet') {
      quiet = true;
    } else if (arg === '--format') {
      format = args[++i];
    } else if (!arg.startsWith('-')) {
      if (!schemaFile) {
        schemaFile = arg;
      } else if (!dataFile) {
        dataFile = arg;
      }
    }
  }

  return { schemaFile, dataFile, useStdin, verbose, quiet, format };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.schemaFile) {
    showHelp();
    process.exit(1);
  }

  // Read schema
  let schema;
  try {
    schema = JSON.parse(readFileSync(opts.schemaFile, 'utf-8'));
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} Reading schema: ${err.message}`);
    process.exit(1);
  }

  // Read data
  let data;
  if (opts.dataFile) {
    try {
      data = JSON.parse(readFileSync(opts.dataFile, 'utf-8'));
    } catch (err) {
      console.error(`  ${C.red}Error:${C.reset} Reading data: ${err.message}`);
      process.exit(1);
    }
  } else if (opts.useStdin || !process.stdin.isTTY) {
    try {
      const chunks = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      const input = Buffer.concat(chunks).toString('utf-8');
      if (!input.trim()) {
        console.error(`  ${C.red}Error:${C.reset} No JSON input from stdin`);
        process.exit(1);
      }
      data = JSON.parse(input);
    } catch (err) {
      console.error(`  ${C.red}Error:${C.reset} Reading stdin: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.error(`  ${C.red}Error:${C.reset} No data file specified`);
    process.exit(1);
  }

  // Validate
  const errors = validate(data, schema);

  // Display results
  displayResults(errors, {
    verbose: opts.verbose,
    quiet: opts.quiet,
    format: opts.format,
  });
}

main();
