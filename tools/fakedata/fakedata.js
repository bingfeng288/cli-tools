#!/usr/bin/env node

import { randomInt, randomUUID } from 'node:crypto';

// --- Data ---
const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Lisa', 'Daniel', 'Nancy',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
  'Steven', 'Dorothy', 'Paul', 'Kimberly', 'Andrew', 'Emily', 'Joshua', 'Donna',
  'Alice', 'Bob', 'Charlie', 'Diana', 'Edward', 'Fiona', 'George', 'Hannah',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
];

const DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'example.com', 'mail.com'];

const CITIES = [
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
  'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
  'Fort Worth', 'Columbus', 'Charlotte', 'Indianapolis', 'San Francisco', 'Seattle',
  'Denver', 'Washington', 'Nashville', 'Oklahoma City', 'El Paso', 'Boston',
];

const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const STREETS = [
  'Main St', 'Oak Ave', 'Elm St', 'Park Ave', 'Maple Dr', 'Cedar Ln',
  'Pine St', 'Washington Ave', 'Lake Dr', 'Hill Rd', 'River Rd', 'Sunset Blvd',
  'Broadway', 'Market St', 'Church St', 'Spring St', 'Highland Ave', 'Forest Dr',
];

const COLORS = [
  'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown',
  'black', 'white', 'gray', 'cyan', 'magenta', 'teal', 'navy', 'maroon',
];

const ADJECTIVES = [
  'happy', 'sad', 'angry', 'excited', 'tired', 'hungry', 'thirsty', 'cold',
  'hot', 'fast', 'slow', 'big', 'small', 'tall', 'short', 'old', 'new',
  'good', 'bad', 'beautiful', 'ugly', 'smart', 'funny', 'serious', 'quiet',
];

const NOUNS = [
  'cat', 'dog', 'bird', 'fish', 'tree', 'flower', 'mountain', 'river',
  'ocean', 'sun', 'moon', 'star', 'book', 'car', 'house', 'computer',
  'phone', 'music', 'art', 'science', 'history', 'nature', 'city', 'country',
];

const VERBS = [
  'runs', 'jumps', 'flies', 'swims', 'walks', 'reads', 'writes', 'sings',
  'dances', 'eats', 'drinks', 'sleeps', 'thinks', 'speaks', 'listens', 'watches',
];

// --- Helpers ---
function pick(arr) {
  return arr[randomInt(arr.length)];
}

function randomDigits(n) {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += randomInt(10).toString();
  }
  return s;
}

// --- Generators ---
function firstName() { return pick(FIRST_NAMES); }
function lastName() { return pick(LAST_NAMES); }
function fullName() { return `${firstName()} ${lastName()}`; }
function email() {
  const first = firstName().toLowerCase();
  const last = lastName().toLowerCase();
  const domain = pick(DOMAINS);
  const sep = pick(['.', '_', '']);
  return `${first}${sep}${last}@${domain}`;
}
function phone() {
  const area = randomDigits(3);
  const p1 = randomDigits(3);
  const p2 = randomDigits(4);
  return `(${area}) ${p1}-${p2}`;
}
function address() {
  return `${randomInt(9999) + 1} ${pick(STREETS)}`;
}
function city() { return pick(CITIES); }
function state() { return pick(STATES); }
function zipCode() { return randomDigits(5); }
function fullAddress() {
  return `${address()}, ${city()}, ${state()} ${zipCode()}`;
}
function date(startYear = 1970, endYear = 2025) {
  const year = startYear + randomInt(endYear - startYear + 1);
  const month = randomInt(12) + 1;
  const day = randomInt(28) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function uuid() { return randomUUID(); }
function number(min = 0, max = 100) { return min + randomInt(max - min + 1); }
function boolean() { return randomInt(2) === 0; }
function color() { return pick(COLORS); }
function sentence() {
  const len = 5 + randomInt(10);
  const words = [];
  for (let i = 0; i < len; i++) {
    words.push(pick([...ADJECTIVES, ...NOUNS, ...VERBS]));
  }
  words[0] = words[0][0].toUpperCase() + words[0].slice(1);
  return words.join(' ') + '.';
}
function paragraph() {
  const count = 3 + randomInt(5);
  const sentences = [];
  for (let i = 0; i < count; i++) {
    sentences.push(sentence());
  }
  return sentences.join(' ');
}
function company() {
  const suffixes = ['Inc', 'LLC', 'Corp', 'Co', 'Ltd', 'Group'];
  return `${pick(NOUNS)[0].toUpperCase() + pick(NOUNS).slice(1)} ${pick(suffixes)}`;
}
function jobTitle() {
  const titles = ['Engineer', 'Manager', 'Developer', 'Designer', 'Analyst', 'Director', 'Specialist', 'Coordinator', 'Consultant', 'Administrator'];
  const levels = ['Senior', 'Junior', 'Lead', 'Staff', 'Principal', 'Chief'];
  return `${pick(levels)} ${pick(titles)}`;
}
function url() {
  const domain = pick(DOMAINS);
  return `https://www.${domain}`;
}
function ip() {
  return `${randomInt(256)}.${randomInt(256)}.${randomInt(256)}.${randomInt(256)}`;
}
function mac() {
  const parts = [];
  for (let i = 0; i < 6; i++) {
    parts.push(randomInt(256).toString(16).padStart(2, '0'));
  }
  return parts.join(':');
}

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mfakedata\x1b[0m - Fake data generator

  \x1b[1mUsage:\x1b[0m
    fakedata <type> [options]

  \x1b[1mTypes:\x1b[0m
    name          Full name
    firstname     First name
    lastname      Last name
    email         Email address
    phone         Phone number
    address       Street address
    city          City name
    state         State abbreviation
    zip           ZIP code
    fulladdress   Complete address
    date          Random date
    uuid          UUID v4
    number        Random number
    bool          Boolean value
    color         Color name
    sentence      Random sentence
    paragraph     Random paragraph
    company       Company name
    job           Job title
    url           URL
    ip            IPv4 address
    mac           MAC address
    person        Full person object
    contact       Contact info object

  \x1b[1mOptions:\x1b[0m
    -n, --count <n>     Number of items (default: 1)
    --json              Output as JSON
    -h, --help          Show this help

  \x1b[1mExamples:\x1b[0m
    fakedata name
    fakedata email -n 5
    fakedata person --json
    fakedata number 1 100
`);
}

// --- Person object ---
function person() {
  return {
    name: fullName(),
    email: email(),
    phone: phone(),
    address: fullAddress(),
    company: company(),
    job: jobTitle(),
    birthdate: date(1960, 2005),
    uuid: uuid(),
  };
}

function contact() {
  return {
    name: fullName(),
    email: email(),
    phone: phone(),
  };
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let type = null;
  let count = 1;
  let jsonOutput = false;
  let min = 0;
  let max = 100;
  let extraArgs = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-n' || arg === '--count') {
      count = parseInt(args[++i]) || 1;
    } else if (arg === '--json') {
      jsonOutput = true;
    } else if (!arg.startsWith('-')) {
      if (!type) {
        type = arg;
      } else {
        extraArgs.push(arg);
      }
    }
  }

  if (extraArgs.length >= 2) {
    min = parseInt(extraArgs[0]) || 0;
    max = parseInt(extraArgs[1]) || 100;
  }

  return { type, count, jsonOutput, min, max };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  if (!opts.type) {
    showHelp();
    return;
  }

  const generators = {
    name: fullName,
    firstname: firstName,
    lastname: lastName,
    email,
    phone,
    address,
    city,
    state,
    zip: zipCode,
    zipCode,
    fulladdress: fullAddress,
    date,
    uuid,
    number: () => number(opts.min, opts.max),
    bool: boolean,
    boolean,
    color,
    sentence,
    paragraph,
    company,
    job: jobTitle,
    jobTitle,
    url,
    ip,
    mac,
    person,
    contact,
  };

  const generator = generators[opts.type.toLowerCase()];
  if (!generator) {
    console.error(`  Error: Unknown type: ${opts.type}`);
    process.exit(1);
  }

  const results = [];
  for (let i = 0; i < opts.count; i++) {
    results.push(generator());
  }

  if (opts.jsonOutput) {
    console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
  } else {
    console.log();
    results.forEach(r => {
      if (typeof r === 'object') {
        console.log(JSON.stringify(r));
      } else {
        console.log(`  ${r}`);
      }
    });
    console.log();
  }
}

main();
