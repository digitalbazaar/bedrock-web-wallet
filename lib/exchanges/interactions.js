/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */

/**
 * Checks whether a URL is an interaction URL (`https:` with `iuv=1`), e.g.,
 * a `redirectUrl` that continues an interaction at a new exchange.
 *
 * @param {object} options - The options to use.
 * @param {string|URL} options.url - The URL to check.
 *
 * @returns {boolean} `true` if `url` is an interaction URL.
 */
export function isInteractionUrl({url} = {}) {
  try {
    parseInteractionUrl({url});
    return true;
  } catch {
    return false;
  }
}

/**
 * Parses an interaction URL, which must use `https:` and include `iuv=1`.
 *
 * @param {object} options - The options to use.
 * @param {string|URL} options.url - The interaction URL.
 *
 * @returns {URL} The parsed URL.
 */
export function parseInteractionUrl({url} = {}) {
  const parsed = new URL(url);
  if(parsed.protocol !== 'https:') {
    const err = new Error(
      `Unsupported interaction URL "${url}": ` +
      `Unsupported protocol "${parsed.protocol}".`);
    err.name = 'NotSupportedError';
    throw err;
  }
  if(parsed.searchParams.get('iuv') !== '1') {
    const err = new Error(
      `Unsupported interaction URL "${url}": Missing query param "iuv=1".`);
    err.name = 'NotSupportedError';
    throw err;
  }
  return parsed;
}
