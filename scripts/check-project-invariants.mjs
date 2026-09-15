import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const failures = [];
const ignoredDirectories = new Set([
  '.git',
  '.meteor/local',
  '.meteor/local-integration',
  '.meteor/local-playwright',
  '.playwright-mcp',
  '_build',
  '_build-local-integration',
  '_build-local-playwright',
  'coverage',
  'node_modules',
  'playwright-report',
  'public/build-assets',
  'public/build-assets-local-integration',
  'public/build-assets-local-playwright',
  'public/build-chunks',
  'public/build-chunks-local-integration',
  'public/build-chunks-local-playwright',
  'test-results',
]);
const sourceExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.mjs',
  '.ts',
  '.tsx',
]);
const markdownPrefixes = ['CORE_', 'PLATFORM_', 'MAP_', 'AUDIT_', 'TEMP_'];

const read = (path) => readFileSync(join(root, path), 'utf8');

const addFailure = (message) => {
  failures.push(message);
};

const isIgnored = (path) =>
  [...ignoredDirectories].some(
    (ignored) => path === ignored || path.startsWith(`${ignored}/`),
  );

const walkFiles = (directory, predicate, files = []) => {
  for (const entry of readdirSync(directory)) {
    const absolutePath = join(directory, entry);
    const relativePath = relative(root, absolutePath);

    if (isIgnored(relativePath)) {
      continue;
    }

    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      walkFiles(absolutePath, predicate, files);
      continue;
    }

    if (stats.isFile() && predicate(relativePath)) {
      files.push(relativePath);
    }
  }

  return files;
};

if (read('.meteor/release').trim() !== 'METEOR@3.5.1') {
  addFailure('.meteor/release must remain METEOR@3.5.1');
}

const meteorPackages = read('.meteor/packages');
for (const forbiddenPackage of ['autopublish', 'insecure']) {
  if (new RegExp(`^${forbiddenPackage}(?:@|\\s|$)`, 'm').test(meteorPackages)) {
    addFailure(`Forbidden Meteor package is present: ${forbiddenPackage}`);
  }
}

const packageJson = JSON.parse(read('package.json'));
if (packageJson.name !== 'rugby-rooster') {
  addFailure('package.json name must remain rugby-rooster');
}

for (const dependencyType of ['dependencies', 'devDependencies']) {
  if (packageJson[dependencyType]?.meteor) {
    addFailure('Do not install the Meteor CLI installer into package.json');
  }
}

const sourceFiles = walkFiles(
  root,
  (path) =>
    sourceExtensions.has(extname(path)) &&
    path !== 'scripts/check-project-invariants.mjs',
);
const starterPatterns = [
  [/Welcome to Meteor/i, 'starter Meteor welcome copy'],
  [/Learn Meteor/i, 'starter Meteor learning copy'],
  [/LinksCollection/, 'starter LinksCollection API'],
];

for (const file of sourceFiles) {
  const content = read(file);

  for (const [pattern, label] of starterPatterns) {
    if (pattern.test(content)) {
      addFailure(`${file}: contains ${label}`);
    }
  }
}

const markdownFiles = walkFiles(root, (path) => extname(path) === '.md');
for (const file of markdownFiles) {
  const inDocs = file.startsWith('docs/');
  const allowedRootFile = file === 'README.md' || file === 'AGENTS.md';

  if (!inDocs && !allowedRootFile) {
    addFailure(`${file}: task-created Markdown must live under docs/`);
  }

  if (inDocs) {
    const name = file.split('/').at(-1) ?? '';
    const hasKnownPrefix = markdownPrefixes.some((prefix) =>
      name.startsWith(prefix),
    );

    if (!hasKnownPrefix) {
      addFailure(`${file}: docs Markdown needs a configured prefix`);
    }
  }
}

for (const requiredPath of [
  'AGENTS.md',
  'README.md',
  'docs/CORE_Product.md',
  'docs/CORE_Build_Plan.md',
  'docs/PLATFORM_Architecture.md',
  'docs/PLATFORM_Testing.md',
  'docs/MAP_System.md',
  'docs/AUDIT_001_Project_Foundation.md',
  'docs/AUDIT_002_Testing_Infrastructure.md',
]) {
  if (!existsSync(join(root, requiredPath))) {
    addFailure(`${requiredPath}: required project document is missing`);
  }
}

if (failures.length > 0) {
  console.error('Project invariant check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.info('Project invariant check passed.');
