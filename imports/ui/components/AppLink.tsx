import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';

interface AppLinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> {
  readonly children: ReactNode;
  readonly to: string;
}

export const AppLink = ({ children, onClick, to, ...props }: AppLinkProps) => {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    const target = event.currentTarget;

    if (
      target.hasAttribute('download') ||
      (target.target && target.target !== '_self')
    ) {
      return;
    }

    const nextUrl = new URL(target.href);
    const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const nextLocation = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;

    if (nextUrl.origin !== window.location.origin) {
      return;
    }

    event.preventDefault();

    if (currentLocation !== nextLocation) {
      window.history.pushState({}, '', nextLocation);
      window.dispatchEvent(new Event('rugby-rooster:navigate'));
    }
  };

  return (
    <a href={to} onClick={handleClick} {...props}>
      {children}
    </a>
  );
};
