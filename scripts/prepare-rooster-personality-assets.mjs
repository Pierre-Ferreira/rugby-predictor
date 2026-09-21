import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const sourceDir = 'assets/source/rooster/personality';
const runtimeDir = 'public/assets/rooster/personality';
const manifestPath = join(runtimeDir, 'personality-manifest.json');
const maxRuntimeSize = 640;

const assets = [
  {
    mood: 'confident',
    output: 'rooster-confident.png',
    pose: 'full-body',
    source: 'rooster-canonical-confident-source.png',
    sourceRect: { height: 1160, width: 1080, x: 90, y: 25 },
  },
  {
    mood: 'thinking',
    output: 'rooster-thinking.png',
    pose: 'bust',
    source: 'rooster-expression-sheet-1-source.png',
    sourceRect: { height: 420, width: 500, x: 512, y: 25 },
  },
  {
    mood: 'celebrating',
    output: 'rooster-celebrating.png',
    pose: 'bust',
    source: 'rooster-expression-sheet-1-source.png',
    sourceRect: { height: 450, width: 526, x: 1010, y: 0 },
  },
  {
    mood: 'nervous',
    output: 'rooster-nervous.png',
    pose: 'bust',
    source: 'rooster-expression-sheet-1-source.png',
    sourceRect: { height: 440, width: 510, x: 0, y: 510 },
  },
  {
    mood: 'shocked',
    output: 'rooster-shocked.png',
    pose: 'bust',
    source: 'rooster-expression-sheet-1-source.png',
    sourceRect: { height: 448, width: 510, x: 514, y: 502 },
  },
  {
    mood: 'disappointed',
    output: 'rooster-disappointed.png',
    pose: 'bust',
    source: 'rooster-expression-sheet-1-source.png',
    sourceRect: { height: 440, width: 501, x: 1035, y: 505 },
  },
  {
    mood: 'tantrum',
    output: 'rooster-tantrum.png',
    pose: 'full-body',
    source: 'rooster-expression-sheet-2-source.png',
    sourceRect: { height: 590, width: 520, x: 0, y: 0 },
  },
  {
    mood: 'crying',
    output: 'rooster-crying.png',
    pose: 'full-body',
    source: 'rooster-expression-sheet-2-source.png',
    sourceRect: { height: 600, width: 500, x: 520, y: 0 },
  },
  {
    mood: 'cooked',
    output: 'rooster-cooked.png',
    pose: 'full-body',
    source: 'rooster-expression-sheet-2-source.png',
    sourceRect: { height: 590, width: 511, x: 1025, y: 10 },
  },
  {
    mood: 'superCooked',
    output: 'rooster-super-cooked.png',
    pose: 'gag-object',
    source: 'rooster-super-cooked-source.png',
    sourceRect: { height: 710, width: 1000, x: 45, y: 265 },
  },
];

const run = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`,
    );
  }

  return result.stdout.trim();
};

const ensureFile = (path) => {
  if (!existsSync(path)) {
    throw new Error(`Missing required asset: ${path}`);
  }
};

const sha256 = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

const imageInfo = (path) => {
  const [width, height, channels] = run('identify', [
    '-format',
    '%w %h %[channels]',
    path,
  ]).split(/\s+/);

  return {
    channels,
    height: Number(height),
    width: Number(width),
  };
};

const geometryFromRect = ({ height, width, x, y }) =>
  `${width}x${height}+${x}+${y}`;

mkdirSync(runtimeDir, { recursive: true });

const manifestAssets = assets.map((asset) => {
  const sourcePath = join(sourceDir, asset.source);
  const outputPath = join(runtimeDir, asset.output);
  const { height, width } = asset.sourceRect;

  ensureFile(sourcePath);

  run('convert', [
    sourcePath,
    '-crop',
    geometryFromRect(asset.sourceRect),
    '+repage',
    '-alpha',
    'set',
    '-fuzz',
    '7%',
    '-fill',
    'none',
    '-draw',
    'matte 0,0 floodfill',
    '-draw',
    `matte ${width - 1},0 floodfill`,
    '-draw',
    `matte 0,${height - 1} floodfill`,
    '-draw',
    `matte ${width - 1},${height - 1} floodfill`,
    '-trim',
    '+repage',
    '-resize',
    `${maxRuntimeSize}x${maxRuntimeSize}>`,
    '-strip',
    outputPath,
  ]);

  const outputInfo = imageInfo(outputPath);

  if (!outputInfo.channels.toLowerCase().includes('a')) {
    throw new Error(`Prepared asset must keep alpha channel: ${outputPath}`);
  }

  return {
    mood: asset.mood,
    output: outputPath,
    outputDimensions: {
      height: outputInfo.height,
      width: outputInfo.width,
    },
    pose: asset.pose,
    source: sourcePath,
    sourceFile: basename(sourcePath),
    sourceRect: asset.sourceRect,
    sourceSha256: sha256(sourcePath),
  };
});

writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      generator: basename(
        process.argv[1] ?? 'prepare-rooster-personality-assets.mjs',
      ),
      maxRuntimeSize,
      assets: manifestAssets,
    },
    null,
    2,
  )}\n`,
);

console.info(`Prepared ${manifestAssets.length} personality assets.`);
console.info(`Wrote ${manifestPath}.`);
