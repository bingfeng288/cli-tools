---
title: Getting Started with Node.js
date: 2024-01-20
tags: [javascript, nodejs, tutorial]
description: A beginner's guide to Node.js
---

# Getting Started with Node.js

Node.js is a powerful JavaScript runtime built on Chrome's V8 engine.

## Installation

Download and install Node.js from the official website:

```bash
# Check installation
node --version
npm --version
```

## Your First Application

Create a file called `app.js`:

```javascript
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello, World!\n');
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000/');
});
```

## Key Concepts

- **Modules** - Organize your code into reusable pieces
- **npm** - Package manager for JavaScript
- **Async/Await** - Handle asynchronous operations elegantly

## Next Steps

1. Learn about Express.js for web applications
2. Explore database integration
3. Build RESTful APIs

Happy coding!
