import { useState, type CSSProperties } from 'react';

export type RugbyRoosterMood =
  | 'celebrating'
  | 'confident'
  | 'cooked'
  | 'crying'
  | 'disappointed'
  | 'nervous'
  | 'running'
  | 'shocked'
  | 'superCooked'
  | 'tantrum'
  | 'thinking';

export type RugbyRoosterPersonalitySize = 'compact' | 'hero' | 'standard';

export interface RugbyRoosterPersonalityAsset {
  readonly height: number;
  readonly mood: RugbyRoosterMood;
  readonly pose: 'action' | 'bust' | 'full-body' | 'gag-object';
  readonly role: 'approved-action' | 'approved-static-ui';
  readonly src: string;
  readonly width: number;
}

export const rugbyRoosterPersonalityAssets: Record<
  RugbyRoosterMood,
  RugbyRoosterPersonalityAsset
> = {
  celebrating: {
    height: 429,
    mood: 'celebrating',
    pose: 'bust',
    role: 'approved-static-ui',
    src: '/assets/rooster/personality/rooster-celebrating.png',
    width: 465,
  },
  confident: {
    height: 640,
    mood: 'confident',
    pose: 'full-body',
    role: 'approved-static-ui',
    src: '/assets/rooster/personality/rooster-confident.png',
    width: 593,
  },
  cooked: {
    height: 578,
    mood: 'cooked',
    pose: 'full-body',
    role: 'approved-static-ui',
    src: '/assets/rooster/personality/rooster-cooked.png',
    width: 391,
  },
  crying: {
    height: 573,
    mood: 'crying',
    pose: 'full-body',
    role: 'approved-static-ui',
    src: '/assets/rooster/personality/rooster-crying.png',
    width: 409,
  },
  disappointed: {
    height: 438,
    mood: 'disappointed',
    pose: 'bust',
    role: 'approved-static-ui',
    src: '/assets/rooster/personality/rooster-disappointed.png',
    width: 415,
  },
  nervous: {
    height: 438,
    mood: 'nervous',
    pose: 'bust',
    role: 'approved-static-ui',
    src: '/assets/rooster/personality/rooster-nervous.png',
    width: 427,
  },
  running: {
    height: 268,
    mood: 'running',
    pose: 'action',
    role: 'approved-action',
    src: '/assets/rooster/match-result/frames/rooster-run-1.png',
    width: 276,
  },
  shocked: {
    height: 445,
    mood: 'shocked',
    pose: 'bust',
    role: 'approved-static-ui',
    src: '/assets/rooster/personality/rooster-shocked.png',
    width: 486,
  },
  superCooked: {
    height: 460,
    mood: 'superCooked',
    pose: 'gag-object',
    role: 'approved-static-ui',
    src: '/assets/rooster/personality/rooster-super-cooked.png',
    width: 640,
  },
  tantrum: {
    height: 573,
    mood: 'tantrum',
    pose: 'full-body',
    role: 'approved-static-ui',
    src: '/assets/rooster/personality/rooster-tantrum.png',
    width: 481,
  },
  thinking: {
    height: 420,
    mood: 'thinking',
    pose: 'bust',
    role: 'approved-static-ui',
    src: '/assets/rooster/personality/rooster-thinking.png',
    width: 412,
  },
};

export const getRugbyRoosterPersonalityAsset = (
  mood: RugbyRoosterMood,
): RugbyRoosterPersonalityAsset => rugbyRoosterPersonalityAssets[mood];

const sizeClassNames: Record<RugbyRoosterPersonalitySize, string> = {
  compact: 'rr-personality--compact',
  hero: 'rr-personality--hero',
  standard: 'rr-personality--standard',
};

export const RugbyRoosterPersonality = ({
  assetSrcOverride,
  className,
  imageAlt = '',
  lazy = true,
  message,
  mood,
  size = 'standard',
}: {
  readonly assetSrcOverride?: string | null;
  readonly className?: string;
  readonly imageAlt?: string;
  readonly lazy?: boolean;
  readonly message?: string;
  readonly mood: RugbyRoosterMood;
  readonly size?: RugbyRoosterPersonalitySize;
}) => {
  const asset = getRugbyRoosterPersonalityAsset(mood);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = assetSrcOverride === undefined ? asset.src : assetSrcOverride;
  const imageFailed = Boolean(src && failedSrc === src);
  const style = {
    '--rr-personality-aspect-ratio': `${asset.width} / ${asset.height}`,
  } as CSSProperties;

  return (
    <aside
      className={[
        'rr-personality',
        sizeClassNames[size],
        imageFailed || !src ? 'rr-personality--image-failed' : '',
        className ?? '',
      ].join(' ')}
      data-mood={mood}
      data-pose={asset.pose}
      style={style}
    >
      {!imageFailed && src ? (
        <img
          alt={imageAlt}
          className="rr-personality__image"
          decoding="async"
          height={asset.height}
          loading={lazy ? 'lazy' : 'eager'}
          src={src}
          width={asset.width}
          onError={() => setFailedSrc(src)}
        />
      ) : null}
      {message ? <p className="rr-personality__message">{message}</p> : null}
    </aside>
  );
};
