import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';

interface AppLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
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

    if (target.origin !== window.location.origin) {
      return;
    }

    event.preventDefault();

    if (window.location.pathname !== to) {
      window.history.pushState({}, '', to);
      window.dispatchEvent(new Event('rugby-rooster:navigate'));
    }
  };

  return (
    <a href={to} onClick={handleClick} {...props}>
      {children}
    </a>
  );
};
