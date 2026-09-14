import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set([
  '.git',
  '.meteor',
  '_build',
  'node_modules',
  'public/build-assets',
  'public/build-chunks',
]);
const checkedExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
]);
const checkedBasenames = new Set(['.gitignore']);

const failures = [];

const isIgnored = (path) =>
  [...ignoredDirectories].some(
    (ignored) => path === ignored || path.startsWith(`${ignored}/`),
  );

const shouldCheck = (path) =>
  checkedBasenames.has(path) || checkedExtensions.has(extname(path));

const walk = (directory) => {
  for (const entry of readdirSync(directory)) {
    const absolutePath = join(directory, entry);
    const relativePath = relative(root, absolutePath);

    if (isIgnored(relativePath)) {
      continue;
    }

    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      walk(absolutePath);
      continue;
    }

    if (!stats.isFile() || !shouldCheck(relativePath)) {
      continue;
    }

    const content = readFileSync(absolutePath, 'utf8');

    if (content.includes('\r\n')) {
      failures.push(`${relativePath}: uses CRLF line endings`);
    }

    if (!content.endsWith('\n')) {
      failures.push(`${relativePath}: missing final newline`);
    }

    content.split('\n').forEach((line, index) => {
      if (/[ \t]+$/.test(line)) {
        failures.push(`${relativePath}:${index + 1}: trailing whitespace`);
      }
    });
  }
};

walk(root);

if (failures.length > 0) {
  console.error('Formatting check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Formatting check passed.');
