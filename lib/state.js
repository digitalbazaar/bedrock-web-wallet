/*!
 * Copyright (c) 2021-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from 'bedrock-web';
import {createSession} from 'bedrock-web-session';
import {CredentialStore} from './CredentialStore.js';
import {LruCache} from '@digitalbazaar/lru-memoize';
import {ProfileManager} from 'bedrock-web-profile-manager';
import {PouchEdvClient} from 'bedrock-web-pouch-edv';
import {VerifiableCredentialStore} from 'bedrock-web-vc-store';

export const caches = {};
export let profileManager;

const MAX_AGE = 24 * 60 * 60 * 5000; // 24 hr
const KMS_MODULE = 'ssm-v1';
const KMS_BASE_URL = `${window.location.origin}/kms`;
const EDV_BASE_URL = `${window.location.origin}/edvs`;

let _initialized = false;
let _accountId = null;

// initialize the web wallet and its internal state
export async function initialize() {
  if(_initialized) {
    throw new Error('Wallet already initialized.');
  }
  _initialized = true;

  profileManager = new ProfileManager({
    edvBaseUrl: EDV_BASE_URL,
    kmsModule: KMS_MODULE,
    kmsBaseUrl: KMS_BASE_URL,
    recoveryHost: window.location.host
  });

  // attach the profile manager to the session so its internal state will
  // be cleared whenever the session changes
  const session = await createSession();
  await session.refresh();
  await profileManager.setSession({session});

  // create caches
  caches.edvClients = new LruCache({maxAge: MAX_AGE});
  caches.credentialStores = new LruCache({maxAge: MAX_AGE});

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
 * @returns {Promise<{edvClient}>}.
 */
export async function getProfileEdvClient({
  profileId, referenceIdPrefix
} = {}) {
  return caches.edvClients.memoize({
    key: 'profile-' + profileId,
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
 * @returns {Promise<{credentialStorage}>}.
 */
export async function getCredentialStore({profileId, password} = {}) {
  return caches.credentialStores.memoize({
    key: 'profile-' + profileId,
    fn: () => _getCredentialStore({profileId, password})
  });
}

async function _getProfileEdvClient({profileId, referenceIdPrefix}) {
  // FIXME: new version of `getProfileEdvAccess` should return `edvClient` and
  // nothing else -- internally handling `capability` and `invocationSigner`
  const {edvClient, capability, invocationSigner} = await profileManager
    .getProfileEdvAccess({profileId, referenceIdPrefix});
  if(!edvClient.capability && capability) {
    edvClient.capability = capability;
  }
  if(!edvClient.invocationSigner && invocationSigner) {
    edvClient.invocationSigner = invocationSigner;
  }
  return {edvClient};
}

async function _getCredentialStore({profileId, password}) {
  const {credentials} = config.wallet.DEFAULT_EDVS;

  // get EDV client for remote VC store
  const {edvClient: remoteEdvClient} = await getProfileEdvClient({
    profileId, referenceIdPrefix: credentials
  });
  const remote = new VerifiableCredentialStore({edvClient: remoteEdvClient});

  // get / lazily create local VC store
  const {capability} = remoteEdvClient;
  const edvId = remoteEdvClient.id || _parseEdvId({capability});
  let localEdvClient;
  try {
    const config = {
      id: edvId,
      controller: profileId
    };
    const result = await PouchEdvClient.createEdv({config, password});
    localEdvClient = result.localEdvClient;
  } catch(e) {
    if(e.name !== 'DuplicateError') {
      throw e;
    }
    localEdvClient = await PouchEdvClient.fromLocalSecrets({edvId, password});
  }
  const local = new VerifiableCredentialStore({edvClient: localEdvClient});

  const credentialStore = new CredentialStore({
    profileId, local, remote
  });
  return {credentialStore};
}

async function _sessionChanged({oldEnded, newData}) {
  const {account = {}} = newData;
  const {id: newAccountId = null} = account;

  // reset caches if account has changed or old session ended
  if(oldEnded || _accountId !== newAccountId) {
    _reset();
  }

  _accountId = newAccountId;
}

function _reset() {
  for(const cache of Object.values(caches)) {
    cache.cache.reset();
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