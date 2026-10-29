/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */

// credential type => `{label, getInteractionUrl}`
const CREDENTIAL_PROVIDERS = new Map();

/**
 * Registers a provider that can supply credentials of the given type when a
 * request asks for one the wallet does not hold.
 *
 * @param {object} options - The options to use.
 * @param {string} options.credentialType - The credential type the provider
 *  supplies, as it appears in a `QueryByExample` example's `type`.
 * @param {object} options.provider - The provider, `{label,
 *  getInteractionUrl}`: `label` names the action that obtains the credential
 *  (e.g., a button label); `getInteractionUrl` is a function that returns a
 *  Promise that resolves to the interaction URL to obtain it from.
 */
export function addCredentialProvider({credentialType, provider} = {}) {
  if(!(credentialType && typeof credentialType === 'string')) {
    throw new TypeError('"credentialType" must be a non-empty string.');
  }
  if(!(provider && typeof provider === 'object')) {
    throw new TypeError('"provider" must be an object.');
  }
  if(typeof provider.label !== 'string') {
    throw new TypeError('"provider.label" must be a string.');
  }
  if(typeof provider.getInteractionUrl !== 'function') {
    throw new TypeError('"provider.getInteractionUrl" must be a function.');
  }
  if(CREDENTIAL_PROVIDERS.has(credentialType)) {
    const err = new Error(
      `A credential provider for "${credentialType}" is already registered.`);
    err.name = 'DuplicateError';
    throw err;
  }
  CREDENTIAL_PROVIDERS.set(credentialType, provider);
}

/**
 * Gets the provider registered for the given credential type.
 *
 * @param {object} options - The options to use.
 * @param {string} options.credentialType - The credential type.
 *
 * @returns {object|undefined} The provider, or `undefined` if none is
 *  registered.
 */
export function getCredentialProvider({credentialType} = {}) {
  return CREDENTIAL_PROVIDERS.get(credentialType);
}

/**
 * Removes the provider registered for the given credential type.
 *
 * @param {object} options - The options to use.
 * @param {string} options.credentialType - The credential type.
 *
 * @returns {boolean} `true` if a provider was removed.
 */
export function removeCredentialProvider({credentialType} = {}) {
  return CREDENTIAL_PROVIDERS.delete(credentialType);
}
