import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const sourceDir = 'assets/source/rooster';
const runtimeDir = 'public/assets/rooster/match-result';
const reviewDir = 'artifacts/ccpp009c-review';
const sourceSheet = join(sourceDir, 'cartoon_rooster_running_sprite_sheet.png');
const referenceSheet = join(
  sourceDir,
  'rooster_animation_loops_reference_sheet.png',
);
const framesDir = join(runtimeDir, 'frames');
const atlasPath = join(runtimeDir, 'rooster-shove-atlas.png');
const manifestPath = join(runtimeDir, 'rooster-shove-manifest.json');
const sourceManifestPath =
  'imports/ui/predictions/kaplay/roosterShoveManifest.generated.json';

const frameWidth = 276;
const frameHeight = 268;
const framePadding = 4;
const sourceToRuntimeScale = 0.56;
const atlasColumns = 4;
const atlasRows = 2;
const atlasCellWidth = frameWidth + framePadding * 2;
const atlasCellHeight = frameHeight + framePadding * 2;
const atlasWidth = atlasColumns * atlasCellWidth;
const atlasHeight = atlasRows * atlasCellHeight;
const alphaThresholdPercent = 1;

const frameDefinitions = [
  {
    animation: 'run',
    cell: 0,
    name: 'rooster-run-1',
    sourceRect: { height: 416, width: 398, x: 16, y: 57 },
  },
  {
    animation: 'run',
    cell: 1,
    name: 'rooster-run-2',
    sourceRect: { height: 420, width: 397, x: 456, y: 47 },
  },
  {
    animation: 'run',
    cell: 2,
    name: 'rooster-run-3',
    sourceRect: { height: 414, width: 364, x: 857, y: 55 },
  },
  {
    animation: 'run',
    cell: 3,
    name: 'rooster-run-4',
    sourceRect: { height: 421, width: 415, x: 1238, y: 47 },
  },
  {
    animation: 'pushRun',
    cell: 4,
    name: 'rooster-push-1',
    sourceRect: { height: 387, width: 462, x: 1, y: 515 },
  },
  {
    animation: 'pushRun',
    cell: 5,
    name: 'rooster-push-2',
    sourceRect: { height: 383, width: 403, x: 462, y: 515 },
  },
  {
    animation: 'pushRun',
    cell: 6,
    cleanupRects: [
      { height: 63, width: 14, x: 262, y: 205 },
      { height: 18, width: 12, x: 234, y: 220 },
    ],
    name: 'rooster-push-3',
    sourceRect: { height: 390, width: 392, x: 860, y: 509 },
  },
  {
    animation: 'pushRun',
    cell: 7,
    name: 'rooster-push-4',
    sourceRect: { height: 392, width: 412, x: 1260, y: 509 },
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

const parseBox = (value) => {
  const match = value.match(/^(\d+)x(\d+)\+(-?\d+)\+(-?\d+)$/);

  if (!match) {
    throw new Error(`Unable to parse ImageMagick box: ${value}`);
  }

  return {
    height: Number(match[2]),
    width: Number(match[1]),
    x: Number(match[3]),
    y: Number(match[4]),
  };
};

const alphaBounds = (crop) =>
  parseBox(
    run('convert', [
      sourceSheet,
      '-crop',
      crop,
      '+repage',
      '-alpha',
      'extract',
      '-threshold',
      `${alphaThresholdPercent}%`,
      '-format',
      '%@',
      'info:',
    ]),
  );

const runtimePointFromSource = (point, renderedRect) => {
  return {
    x: Math.round(renderedRect.x + point.x * sourceToRuntimeScale),
    y: Math.round(renderedRect.y + point.y * sourceToRuntimeScale),
  };
};

ensureFile(sourceSheet);
ensureFile(referenceSheet);
mkdirSync(framesDir, { recursive: true });
mkdirSync(runtimeDir, { recursive: true });
mkdirSync(reviewDir, { recursive: true });
mkdirSync('imports/ui/predictions/kaplay', { recursive: true });

const sheetInfo = imageInfo(sourceSheet);
const referenceInfo = imageInfo(referenceSheet);

if (sheetInfo.width !== 1672 || sheetInfo.height !== 941) {
  throw new Error(
    `Unexpected runtime sheet dimensions ${sheetInfo.width}x${sheetInfo.height}; expected 1672x941.`,
  );
}

if (!sheetInfo.channels.includes('a')) {
  throw new Error('Runtime sheet must contain an alpha channel.');
}

const frames = frameDefinitions.map((definition, index) => {
  const sourceRect = definition.sourceRect;
  const crop = `${sourceRect.width}x${sourceRect.height}+${sourceRect.x}+${sourceRect.y}`;
  const bounds = alphaBounds(crop);
  const outputPath = join(framesDir, `${definition.name}.png`);
  const scaledWidth = Math.round(sourceRect.width * sourceToRuntimeScale);
  const scaledHeight = Math.round(sourceRect.height * sourceToRuntimeScale);
  const sourceGroundY = bounds.y + bounds.height;
  const sourceBodyCenterX = bounds.x + bounds.width / 2;
  const runtimeGroundY = 250;
  const runtimeBodyCenterX = 134;
  const renderedRect = {
    height: scaledHeight,
    width: scaledWidth,
    x: Math.round(
      runtimeBodyCenterX - sourceBodyCenterX * sourceToRuntimeScale,
    ),
    y: Math.round(runtimeGroundY - sourceGroundY * sourceToRuntimeScale),
  };

  run('convert', [
    '-size',
    `${frameWidth}x${frameHeight}`,
    'xc:none',
    '(',
    sourceSheet,
    '-crop',
    crop,
    '+repage',
    '-background',
    'none',
    '-alpha',
    'on',
    '-resize',
    `${scaledWidth}x${scaledHeight}!`,
    ')',
    '-geometry',
    `${renderedRect.x >= 0 ? '+' : ''}${renderedRect.x}${renderedRect.y >= 0 ? '+' : ''}${renderedRect.y}`,
    '-composite',
    outputPath,
  ]);

  for (const rect of definition.cleanupRects ?? []) {
    run('convert', [
      outputPath,
      '-region',
      `${rect.width}x${rect.height}+${rect.x}+${rect.y}`,
      '-alpha',
      'set',
      '-channel',
      'A',
      '-evaluate',
      'set',
      '0',
      '+channel',
      outputPath,
    ]);
  }

  const atlasColumn = index % atlasColumns;
  const atlasRow = Math.floor(index / atlasColumns);
  const groundY = Math.round(
    renderedRect.y + sourceGroundY * sourceToRuntimeScale,
  );
  const bodyCenterX = Math.round(
    renderedRect.x + sourceBodyCenterX * sourceToRuntimeScale,
  );

  return {
    alphaBounds: bounds,
    atlasRect: {
      height: frameHeight,
      width: frameWidth,
      x: framePadding + atlasColumn * atlasCellWidth,
      y: framePadding + atlasRow * atlasCellHeight,
    },
    index,
    name: definition.name,
    outputPath: relative('.', outputPath),
    registration: {
      bodyCenterX,
      groundY,
      renderedRect,
      scale: sourceToRuntimeScale,
    },
    sourceCell: definition.cell + 1,
    sourceRect,
  };
});

const atlasArgs = ['-size', `${atlasWidth}x${atlasHeight}`, 'xc:none'];

for (const frame of frames) {
  atlasArgs.push(
    frame.outputPath,
    '-geometry',
    `+${frame.atlasRect.x}+${frame.atlasRect.y}`,
    '-composite',
  );
}

atlasArgs.push(atlasPath);
run('convert', atlasArgs);

const pushContactPoints = frames
  .filter((frame) => frame.name.startsWith('rooster-push-'))
  .map((frame) => {
    const sourceX = frame.alphaBounds.x + frame.alphaBounds.width - 12;
    const sourceY =
      frame.alphaBounds.y + Math.round(frame.alphaBounds.height * 0.31);

    return runtimePointFromSource(
      {
        x: sourceX,
        y: sourceY,
      },
      frame.registration.renderedRect,
    );
  });

const averagePoint = (points) => ({
  x: Math.round(
    points.reduce((sum, point) => sum + point.x, 0) / points.length,
  ),
  y: Math.round(
    points.reduce((sum, point) => sum + point.y, 0) / points.length,
  ),
});

const manifest = {
  animations: {
    pushRun: {
      fps: 14,
      frames: frames
        .filter((frame) => frame.name.startsWith('rooster-push-'))
        .map((frame) => frame.index),
      loop: true,
    },
    run: {
      fps: 13,
      frames: frames
        .filter((frame) => frame.name.startsWith('rooster-run-'))
        .map((frame) => frame.index),
      loop: true,
    },
  },
  atlas: {
    height: atlasHeight,
    image: '/assets/rooster/match-result/rooster-shove-atlas.png',
    padding: framePadding,
    spriteName: 'rooster-shove',
    width: atlasWidth,
  },
  frame: {
    height: frameHeight,
    width: frameWidth,
  },
  frames,
  inspection: {
    alphaThresholdPercent,
    notes: [
      'The runtime sheet is RGBA and the labelled reference sheet is RGB reference-only art.',
      'Several source cells have alpha touching a cell edge; full source cells are preserved to avoid pre-cropping character parts.',
      'The supplied art contains visible red/green matte halos around dark outlines on contrasting backgrounds.',
      'No black pixels were erased because the rooster uses dark outlines and dark-blue tail feathers.',
    ],
  },
  kaplayAtlas: {
    'rooster-shove': {
      anims: {
        pushRun: {
          frames: [4, 5, 6, 7],
          loop: true,
          speed: 14,
        },
        run: {
          frames: [0, 1, 2, 3],
          loop: true,
          speed: 13,
        },
      },
      height: atlasCellHeight * atlasRows,
      sliceX: 4,
      sliceY: 2,
      width: atlasCellWidth * atlasColumns,
      x: 0,
      y: 0,
    },
  },
  preparation: {
    atlasColumns,
    atlasRows,
    command: 'node scripts/prepare-rooster-shove-assets.mjs',
    frameHeight,
    framePadding,
    frameWidth,
    sourceCellStrategy:
      'Measured component bounds expanded by small padding; fixed source scale with stable ground/body registration; pad atlas entries.',
    sourceToRuntimeScale,
    tool: 'ImageMagick convert/identify',
  },
  source: {
    referenceSheet: {
      channels: referenceInfo.channels,
      height: referenceInfo.height,
      path: referenceSheet,
      sha256: sha256(referenceSheet),
      width: referenceInfo.width,
    },
    runtimeSheet: {
      channels: sheetInfo.channels,
      height: sheetInfo.height,
      path: sourceSheet,
      sha256: sha256(sourceSheet),
      width: sheetInfo.width,
    },
  },
  version: 1,
  visualAnchors: {
    contactPoint: averagePoint(pushContactPoints),
    frameAnchor: {
      x: Math.round(frameWidth * 0.42),
      y: Math.round(frameHeight * 0.88),
    },
  },
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(sourceManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const framePaths = frames.map((frame) => frame.outputPath);

run('montage', [
  ...framePaths,
  '-tile',
  '4x2',
  '-geometry',
  '+14+14',
  '-background',
  '#f8f7ef',
  join(reviewDir, 'rooster-shove-contact-sheet.png'),
]);
run('montage', [
  ...framePaths,
  '-tile',
  '4x2',
  '-geometry',
  '+14+14',
  '-background',
  '#ffffff',
  join(reviewDir, 'rooster-transparency-light.png'),
]);
run('montage', [
  ...framePaths,
  '-tile',
  '4x2',
  '-geometry',
  '+14+14',
  '-background',
  '#17212b',
  join(reviewDir, 'rooster-transparency-dark.png'),
]);
run('convert', [
  '-dispose',
  'background',
  '-delay',
  '8',
  ...framePaths.slice(0, 4),
  '-loop',
  '0',
  join(reviewDir, 'rooster-run-loop-normal.gif'),
]);
run('convert', [
  '-dispose',
  'background',
  '-delay',
  '24',
  ...framePaths.slice(0, 4),
  '-loop',
  '0',
  join(reviewDir, 'rooster-run-loop-slow.gif'),
]);
run('convert', [
  '-dispose',
  'background',
  '-delay',
  '7',
  ...framePaths.slice(4),
  '-loop',
  '0',
  join(reviewDir, 'rooster-push-run-loop-normal.gif'),
]);
run('convert', [
  '-dispose',
  'background',
  '-delay',
  '21',
  ...framePaths.slice(4),
  '-loop',
  '0',
  join(reviewDir, 'rooster-push-run-loop-slow.gif'),
]);
run('convert', [
  '-dispose',
  'background',
  '-delay',
  '7',
  ...framePaths.slice(0, 4),
  ...framePaths.slice(4),
  '-loop',
  '0',
  join(reviewDir, 'rooster-run-to-push-review.gif'),
]);

console.info(
  [
    `Prepared ${frames.length} rooster frames from ${basename(sourceSheet)}.`,
    `Atlas: ${atlasPath} (${atlasWidth}x${atlasHeight})`,
    `Manifest: ${manifestPath}`,
    `Review evidence: ${reviewDir}`,
  ].join('\n'),
);
