export function toSekkeiyaLoginUrl(returnTo) {
  const url = new URL(window.location.origin);
  url.pathname = '/';
  if (returnTo) {
    url.searchParams.set('return_to', returnTo);
  } else {
    url.searchParams.set('return_to', window.location.pathname);
  }
  return url.toString();
}

export function toSekkeiyaSignupUrl(returnTo) {
  const url = new URL(window.location.origin);
  url.pathname = '/';
  url.searchParams.set('mode', 'signup');
  if (returnTo) {
    url.searchParams.set('return_to', returnTo);
  } else {
    url.searchParams.set('return_to', window.location.pathname);
  }
  return url.toString();
}

export function toSekkeiyaLogoutUrl(returnTo) {
  const url = new URL(window.location.origin);
  url.pathname = '/';
  url.searchParams.set('action', 'logout');
  if (returnTo) {
    url.searchParams.set('return_to', returnTo);
  }
  return url.toString();
}
