/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
export class ClientInteraction {
  /**
   * Creates a new ClientInteraction. The interaction can be created from an
   * interaction URL and a `getProtocols` function that will resolve it to its
   * `protocols` object. The `interactionUrl` may be omitted if a verified
   * origin is specified and the `getProtocols` function will return the
   * specific `protocols` object for the interaction.
   *
   * @param {object} options - The options to use.
   * @param {string|URL} options.interactionUrl - The interaction URL.
   * @param {string} [options.origin] - The expected origin; if an
   *   interaction URL is passed, this value will be checked to ensure that
   *   its origin matches, throwing if not; otherwise any given `origin` value
   *   must be one that was previous verified (i.e., unspoofable).
   * @param {Function} options.getProtocols - A function that, given the
   *   interaction URL as `{url}`, returns a Promise that resolves to its
   *   `protocols` object.
   *
   * @returns {ClientInteraction} - A new client interaction.
   */
  constructor({interactionUrl, origin, getProtocols} = {}) {
    if(typeof getProtocols !== 'function') {
      throw new TypeError('"getProtocols" must be a function.');
    }
    this._getProtocols = getProtocols;
    this._protocols = undefined;

    if(interactionUrl !== undefined) {
      if(typeof interactionUrl === 'string') {
        interactionUrl = _parseInteractionUrl(interactionUrl);
      }
      if(!(interactionUrl instanceof URL)) {
        throw new TypeError('"interactionUrl" must be a string or a URL.');
      }
      this._url = interactionUrl;
      if(origin && interactionUrl.origin !== origin) {
        throw new Error(
          `Interaction URL origin "${interactionUrl.origin}" does not match ` +
          `expected origin "${origin}".`);
      }
      this._origin = interactionUrl.origin;
    } else {
      if(typeof origin !== 'string') {
        throw new TypeError('"origin" must be a string.');
      }
      // ensure origin parses
      const parsed = new URL(origin);
      if(parsed.protocol !== 'https:') {
        const err = new Error(
          `Unsupported interaction origin "${origin}": ` +
          `unsupported protocol "${parsed.protocol}".`);
        err.name = 'NotSupportedError';
        throw err;
      }
      this._url = null;
      this._origin = origin;
    }
  }

  /**
   * Gets the protocols associated with this interaction.
   *
   * @returns {Promise<object>} - An object with protocol names as keys and
   *   protocol URLs as values.
   */
  async getProtocols() {
    if(this._protocols !== undefined) {
      return this._protocols;
    }

    try {
      const protocols = await this._getProtocols({url: this._url});
      if(!(protocols && typeof protocols === 'object')) {
        throw new TypeError('"protocols" must be an object.');
      }
      this._protocols = protocols;
      return protocols;
    } catch(cause) {
      const err = new Error(
        `Could not get "protocols" for interaction URL "${this._url}": ` +
        cause.message);
      err.name = 'DataError';
      err.cause = cause;
      throw err;
    }
  }
}

function _parseInteractionUrl(url) {
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
