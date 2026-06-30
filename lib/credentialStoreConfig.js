/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */

/**
 * Gets the `VerifiableCredentialStore` construction options for a particular
 * store from the credential store config. Each store ("local" or "remote")
 * must read from its own `options` block; reading the wrong block leaves a
 * store's `options` unused and silently applies the other store's options.
 *
 * @param {object} options - The options to use.
 * @param {object} options.credentialStore - The `config.wallet.credentialStore`
 *   config object, with `local` and `remote` sub-configs.
 * @param {string} options.store - The store to get options for: "local" or
 *   "remote".
 *
 * @returns {object} The construction options for the store.
 */
export function getStoreOptions({credentialStore, store}) {
  const storeConfig = credentialStore[store];
  if(!storeConfig) {
    throw new Error(`Unknown credential store "${store}".`);
  }
  const {options} = storeConfig;
  return options;
}

/**
 * Builds the construction args for the local and remote
 * `VerifiableCredentialStore`s, pairing each store's EDV client with the
 * construction options from its OWN config block. This is the pure mapping
 * that was previously inlined in `_getCredentialStore`, where the local store
 * was incorrectly paired with the remote store's options.
 *
 * @param {object} options - The options to use.
 * @param {object} options.credentialStore - The `config.wallet.credentialStore`
 *   config object, with `local` and `remote` sub-configs.
 * @param {object} options.localEdvClient - The EDV client for the local store.
 * @param {object} options.remoteEdvClient - The EDV client for the remote
 *   store.
 *
 * @returns {{local: object, remote: object}} The construction args for each
 *   store, each an object of the form `{...options, edvClient}`.
 */
export function getStoreConstructorArgs({
  credentialStore, localEdvClient, remoteEdvClient
}) {
  const localOptions = getStoreOptions({credentialStore, store: 'local'});
  const remoteOptions = getStoreOptions({credentialStore, store: 'remote'});
  return {
    local: {...localOptions, edvClient: localEdvClient},
    remote: {...remoteOptions, edvClient: remoteEdvClient}
  };
}
