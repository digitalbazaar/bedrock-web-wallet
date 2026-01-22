/*!
 * Copyright (c) 2021-2026 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from '@bedrock/web';
import {createSession} from '@bedrock/web-session';
import {CredentialStore} from './CredentialStore.js';
import {LruCache} from '@digitalbazaar/lru-memoize';
import {PouchEdvClient} from '@bedrock/web-pouch-edv';
import {ProfileManager} from '@bedrock/web-profile-manager';
import {VerifiableCredentialStore} from '@bedrock/web-vc-store';

export const caches = {};
export let profileManager;

let _initialized = false;
let _accountId = null;

// initialize the web wallet and its internal state
export async function initialize() {
  if(_initialized) {
    throw new Error('Wallet already initialized.');
  }

  // TODO: validate `config.wallet`

  _initialized = true;

  const {defaults: defaultConfig} = config.wallet;
  profileManager = new ProfileManager({
    edvBaseUrl: defaultConfig.edvBaseUrl
  });

  // attach the profile manager to the session so its internal state will
  // be cleared whenever the session changes
  const session = await createSession();
  await session.refresh();
  await profileManager.setSession({session});

  // create caches
  const {caches: cacheConfig} = config.wallet;
  caches.edvClients = new LruCache(
    _getCacheConfig(cacheConfig.edvClients));
  caches.credentialStores = new LruCache(
    _getCacheConfig(cacheConfig.credentialStores));

  // reset internal state when session changes
  session.on('change', _sessionChanged);
}

/**
 * Gets (and caches) an EdvClient for accessing a particular EDV.
 *
 * @param {object} options - The options to use.
 * @param {object} options.profileId - The ID of the profile that controls the
 *   EDV.
 * @param {object} options.referenceIdPrefix - The prefix for the reference ID
 *   to pass to `profileManager.getProfileEdvAccess`.
 *
 * @returns {Promise<{edvClient}>} - A Promise.
 */
export async function getProfileEdvClient({
  profileId, referenceIdPrefix
} = {}) {
  return caches.edvClients.memoize({
    key: `profile-${profileId}-${referenceIdPrefix}`,
    fn: () => _getProfileEdvClient({profileId, referenceIdPrefix})
  });
}

/**
 * Gets (and caches) a CredentialStore instance.
 *
 * @param {object} options - The options to use.
 * @param {object} options.profileId - The ID of the profile that the
 *   credential store instance is for.
 * @param {string} options.password - The password for unlocking the local
 *   credential store for the profile.
 *
 * @returns {Promise<{credentialStore}>} - A Promise.
 */
export async function getCredentialStore({profileId, password} = {}) {
  // FIXME: may want option to leave out local version; if so, change the key
  return caches.credentialStores.memoize({
    key: 'profile-' + profileId,
    fn: () => _getCredentialStore({profileId, password})
  });
}

// apply backwards compatibility updates to cache config
function _getCacheConfig(cacheConfig) {
  // coerce `maxSize` w/o `sizeCalculation` to `max`
  if(cacheConfig.maxSize !== undefined &&
    cacheConfig.sizeCalculation === undefined) {
    cacheConfig = {...cacheConfig, max: cacheConfig.maxSize};
    delete cacheConfig.maxSize;
  }

  // coerce `maxAge` to `ttl` in `cacheConfig`
  if(cacheConfig.maxAge !== undefined) {
    cacheConfig = {...cacheConfig, ttl: cacheConfig.maxAge};
    delete cacheConfig.maxAge;
  }

  return cacheConfig;
}

async function _getProfileEdvClient({profileId, referenceIdPrefix}) {
  const {edvClient} = await profileManager.getProfileEdvAccess(
    {profileId, referenceIdPrefix});
  return {edvClient};
}

// FIXME: may want option to leave out `local` store
async function _getCredentialStore({profileId, password}) {
  const {credentials} = config.wallet.defaults.edvs;

  // get EDV client for remote VC store
  const {edvClient: remoteEdvClient} = await getProfileEdvClient({
    profileId, referenceIdPrefix: credentials
  });
  const {options: remoteOptions} = config.wallet.credentialStore.remote;
  const remote = new VerifiableCredentialStore(
    {...remoteOptions, edvClient: remoteEdvClient});

  // get / lazily create local VC store
  const {capability} = remoteEdvClient;
  const remoteEdvId = remoteEdvClient.id || _parseEdvId({capability});
  // strip location off of remote EDV ID to get local EDV ID
  const edvId = remoteEdvId.slice(remoteEdvId.lastIndexOf('/') + 1);
  let localEdvClient;
  try {
    const config = {
      id: edvId,
      controller: profileId,
      sequence: 0
    };
    const result = await PouchEdvClient.createEdv({config, password});
    localEdvClient = result.edvClient;
  } catch(e) {
    if(e.name !== 'DuplicateError') {
      throw e;
    }
    localEdvClient = await PouchEdvClient.fromLocalSecrets({edvId, password});
  }
  const {options: localOptions} = config.wallet.credentialStore.remote;
  const local = new VerifiableCredentialStore(
    {...localOptions, edvClient: localEdvClient});

  const credentialStore = new CredentialStore({profileId, local, remote});
  return credentialStore;
}

async function _sessionChanged({oldEnded, newData}) {
  const {account = {}} = newData;
  const {id: newAccountId = null} = account;

  // reset state if account has changed or old session ended
  if(oldEnded || _accountId !== newAccountId) {
    _reset();
  }

  _accountId = newAccountId;
}

function _reset() {
  // clear caches
  for(const cache of Object.values(caches)) {
    cache.cache.clear();
  }
}

function _parseEdvId({capability}) {
  const {invocationTarget} = capability;
  const idx = invocationTarget.lastIndexOf('/documents');
  if(idx === -1) {
    throw new Error(
      `Invalid EDV invocation target (${invocationTarget}).`);
  }
  return invocationTarget.slice(0, idx);
}
