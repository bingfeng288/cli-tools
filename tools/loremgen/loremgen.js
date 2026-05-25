#!/usr/bin/env node

// --- Word bank ---
const WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
  'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
  'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum', 'vitae', 'elementum',
  'curabitur', 'blandit', 'tempus', 'porttitor', 'auctor', 'urna', 'nunc',
  'faucibus', 'ornare', 'suspendisse', 'potenti', 'nullam', 'ac', 'tortor',
  'dignissim', 'convallis', 'aenean', 'pharetra', 'lacus', 'vel', 'facilisis',
  'volutpat', 'est', 'congue', 'nec', 'sagittis', 'aliquam', 'fringilla',
  'ullamcorper', 'morbi', 'tincidunt', 'augue', 'interdum', 'varius', 'mauris',
  'nibh', 'pellentesque', 'habitant', 'morbi', 'tristique', 'senectus', 'netus',
  'malesuada', 'fames', 'turpis', 'egestas', 'maecenas', 'ultricies', 'mi',
  'feugiat', 'pretium', 'donec', 'massa', 'sapien', 'vulputate', 'posuere',
  'sollicitudin', 'aliquam', 'erat', 'volutpat', 'dui', 'viverra', 'arcu',
  'dictum', 'fusce', 'ut', 'placerat', 'orci', 'nulla', 'pellentesque',
  'dignissim', 'enim', 'sit', 'amet', 'venenatis', 'urna', 'cursus', 'eget',
  'nunc', 'scelerisque', 'viverra', 'mauris', 'in', 'aliquam', 'sem',
  'fringilla', 'ut', 'morbi', 'tincidunt', 'augue', 'interdum', 'varius',
];

const STARTERS = [
  'Lorem ipsum dolor sit amet',
  'Sed ut perspiciatis unde',
  'Nemo enim ipsam voluptatem',
  'Neque porro quisquam est',
  'Ut enim ad minima veniam',
  'Quis autem vel eum iure',
  'At vero eos et accusamus',
  'Nam libero tempore cum soluta',
  'Temporibus autem quibusdam et',
  'Itaque earum rerum hic tenetur',
];

// --- Seeded random ---
function createRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// --- Generators ---
function generateWords(count, rng) {
  const words = [];
  for (let i = 0; i < count; i++) {
    words.push(WORDS[Math.floor(rng() * WORDS.length)]);
  }
  return words;
}

function generateSentence(rng) {
  const length = 8 + Math.floor(rng() * 12);
  const words = generateWords(length, rng);
  words[0] = words[0][0].toUpperCase() + words[0].slice(1);
  return words.join(' ') + '.';
}

function generateParagraph(rng) {
  const sentences = 3 + Math.floor(rng() * 5);
  const parts = [];
  for (let i = 0; i < sentences; i++) {
    parts.push(generateSentence(rng));
  }
  return parts.join(' ');
}

function generateParagraphs(count, rng, startWithLorem = true) {
  const paragraphs = [];
  for (let i = 0; i < count; i++) {
    if (i === 0 && startWithLorem) {
      const rest = generateParagraph(rng);
      paragraphs.push(STARTERS[0] + ', ' + rest[0].toLowerCase() + rest.slice(1));
    } else {
      paragraphs.push(generateParagraph(rng));
    }
  }
  return paragraphs;
}

// --- Structured content ---
function generateList(count, rng, ordered = false) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const words = 3 + Math.floor(rng() * 5);
    items.push(generateWords(words, rng).join(' '));
  }
  return items;
}

function generateHeadings(count, rng) {
  const headings = [];
  for (let i = 0; i < count; i++) {
    const words = 3 + Math.floor(rng() * 5);
    const heading = generateWords(words, rng);
    heading[0] = heading[0][0].toUpperCase() + heading[0].slice(1);
    headings.push(heading.join(' '));
  }
  return headings;
}

// --- HTML output ---
function toHtml(paragraphs) {
  return paragraphs.map(p => `<p>${p}</p>`).join('\n');
}

function toHtmlList(items, ordered = false) {
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag}>\n${items.map(item => `  <li>${item}</li>`).join('\n')}\n</${tag}>`;
}

function toHtmlHeadings(headings, level = 2) {
  return headings.map(h => `<h${level}>${h}</h${level}>`).join('\n');
}

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mloremgen\x1b[0m - Lorem Ipsum text generator

  \x1b[1mUsage:\x1b[0m
    loremgen [count] [options]

  \x1b[1mOptions:\x1b[0m
    -w, --words               Generate words (default if no unit specified)
    -s, --sentences           Generate sentences
    -p, --paragraphs          Generate paragraphs
    -l, --list <count>        Generate a list
    --headings <count>        Generate headings
    --html                    Output as HTML
    --ordered                 Use ordered list
    --no-lorem                Don't start with "Lorem ipsum"
    --seed <number>           Seed for reproducibility
    -h, --help                Show this help

  \x1b[1mExamples:\x1b[0m
    loremgen 50                        50 words
    loremgen 5 -p                      5 paragraphs
    loremgen 10 -s                     10 sentences
    loremgen -l 5                      5-item list
    loremgen 3 -p --html               3 paragraphs as HTML
    loremgen 5 -p --seed 42            Reproducible output
    loremgen --headings 4              4 headings
`);
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let count = null;
  let mode = 'words';
  let html = false;
  let ordered = false;
  let noLorem = false;
  let seed = null;
  let listCount = null;
  let headingCount = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-w' || arg === '--words') {
      mode = 'words';
    } else if (arg === '-s' || arg === '--sentences') {
      mode = 'sentences';
    } else if (arg === '-p' || arg === '--paragraphs') {
      mode = 'paragraphs';
    } else if (arg === '-l' || arg === '--list') {
      listCount = parseInt(args[++i]) || 5;
    } else if (arg === '--headings') {
      headingCount = parseInt(args[++i]) || 3;
    } else if (arg === '--html') {
      html = true;
    } else if (arg === '--ordered') {
      ordered = true;
    } else if (arg === '--no-lorem') {
      noLorem = true;
    } else if (arg === '--seed') {
      seed = parseInt(args[++i]);
    } else if (!arg.startsWith('-') && count === null) {
      count = parseInt(arg);
    }
  }

  return { count, mode, html, ordered, noLorem, seed, listCount, headingCount };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);
  const rng = createRng(opts.seed ?? Date.now());

  // List mode
  if (opts.listCount !== null) {
    const items = generateList(opts.listCount, rng, opts.ordered);
    if (opts.html) {
      console.log(toHtmlList(items, opts.ordered));
    } else {
      items.forEach((item, i) => {
        const prefix = opts.ordered ? `${i + 1}. ` : '- ';
        console.log(`${prefix}${item}`);
      });
    }
    return;
  }

  // Headings mode
  if (opts.headingCount !== null) {
    const headings = generateHeadings(opts.headingCount, rng);
    if (opts.html) {
      console.log(toHtmlHeadings(headings));
    } else {
      headings.forEach(h => console.log(h));
    }
    return;
  }

  const count = opts.count || (opts.mode === 'paragraphs' ? 3 : 5);

  if (opts.mode === 'words') {
    const words = generateWords(count, rng);
    console.log(words.join(' '));
  } else if (opts.mode === 'sentences') {
    for (let i = 0; i < count; i++) {
      console.log(generateSentence(rng));
    }
  } else if (opts.mode === 'paragraphs') {
    const paragraphs = generateParagraphs(count, rng, !opts.noLorem);
    if (opts.html) {
      console.log(toHtml(paragraphs));
    } else {
      paragraphs.forEach(p => console.log(p + '\n'));
    }
  }
}

main();
