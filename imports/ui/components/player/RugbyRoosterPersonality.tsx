import { useState } from 'react';

export type RugbyRoosterMood =
  | 'celebrating'
  | 'confident'
  | 'disappointed'
  | 'neutral'
  | 'nervous'
  | 'shocked'
  | 'thinking'
  | 'waiting';

export interface RugbyRoosterPersonalityAsset {
  readonly height: number;
  readonly mood: RugbyRoosterMood;
  readonly role: 'active-static-ui' | 'app-icon-fallback';
  readonly src: string;
  readonly width: number;
}

export const rugbyRoosterPersonalityAssets: Record<
  RugbyRoosterMood,
  RugbyRoosterPersonalityAsset
> = {
  celebrating: {
    height: 268,
    mood: 'celebrating',
    role: 'active-static-ui',
    src: '/assets/rooster/match-result/frames/rooster-push-4.png',
    width: 276,
  },
  confident: {
    height: 268,
    mood: 'confident',
    role: 'active-static-ui',
    src: '/assets/rooster/match-result/frames/rooster-run-1.png',
    width: 276,
  },
  disappointed: {
    height: 268,
    mood: 'disappointed',
    role: 'active-static-ui',
    src: '/assets/rooster/match-result/frames/rooster-push-2.png',
    width: 276,
  },
  neutral: {
    height: 192,
    mood: 'neutral',
    role: 'app-icon-fallback',
    src: '/icons/rr-icon-192.png',
    width: 192,
  },
  nervous: {
    height: 268,
    mood: 'nervous',
    role: 'active-static-ui',
    src: '/assets/rooster/match-result/frames/rooster-run-3.png',
    width: 276,
  },
  shocked: {
    height: 268,
    mood: 'shocked',
    role: 'active-static-ui',
    src: '/assets/rooster/match-result/frames/rooster-push-1.png',
    width: 276,
  },
  thinking: {
    height: 268,
    mood: 'thinking',
    role: 'active-static-ui',
    src: '/assets/rooster/match-result/frames/rooster-run-2.png',
    width: 276,
  },
  waiting: {
    height: 268,
    mood: 'waiting',
    role: 'active-static-ui',
    src: '/assets/rooster/match-result/frames/rooster-run-4.png',
    width: 276,
  },
};

export const getRugbyRoosterPersonalityAsset = (
  mood: RugbyRoosterMood,
): RugbyRoosterPersonalityAsset => rugbyRoosterPersonalityAssets[mood];

const sizeClassNames = {
  lg: 'rr-personality--lg',
  md: 'rr-personality--md',
  sm: 'rr-personality--sm',
} as const;

export const RugbyRoosterPersonality = ({
  assetSrcOverride,
  className,
  imageAlt = '',
  lazy = true,
  message,
  mood,
  size = 'md',
}: {
  readonly assetSrcOverride?: string | null;
  readonly className?: string;
  readonly imageAlt?: string;
  readonly lazy?: boolean;
  readonly message?: string;
  readonly mood: RugbyRoosterMood;
  readonly size?: keyof typeof sizeClassNames;
}) => {
  const asset = getRugbyRoosterPersonalityAsset(mood);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = assetSrcOverride === undefined ? asset.src : assetSrcOverride;
  const imageFailed = Boolean(src && failedSrc === src);

  return (
    <aside
      className={[
        'rr-personality',
        sizeClassNames[size],
        imageFailed || !src ? 'rr-personality--image-failed' : '',
        className ?? '',
      ].join(' ')}
      data-mood={mood}
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
