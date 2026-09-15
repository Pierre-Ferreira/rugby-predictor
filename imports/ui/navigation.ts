export const navigateTo = (to: string, replace = false) => {
  if (replace) {
    window.history.replaceState({}, '', to);
  } else {
    window.history.pushState({}, '', to);
  }

  window.dispatchEvent(new Event('rugby-rooster:navigate'));
};
