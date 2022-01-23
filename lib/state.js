/*!
 * Copyright (c) 2021-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {LruCache} from '@digitalbazaar/lru-memoize';
import {ProfileManager} from 'bedrock-web-profile-manager';
import {createSession} from 'bedrock-web-session';

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
  caches.profileEdvs = new LruCache({maxAge: MAX_AGE});
  caches.remoteProfileVcStores = new LruCache({maxAge: MAX_AGE});
  caches.localProfileVcStores = new LruCache({maxAge: MAX_AGE});

  // reset internal state when session changes
  session.on('change', _sessionChanged);
}

// FIXME: move getting profile EDV information into a cache in `profileManager`

/**
 * Gets (and caches) the combination of an EdvClient, a zcap, and
 * an invocation signer for accessing an EDV.
 *
 * @param {object} options - The options to use.
 * @param {object} options.profileId - The ID of the profile that controls the
 *   EDV.
 * @param {object} options.referenceIdPrefix - The prefix for the reference ID
 *   to pass to `profileManager.getProfileEdvAccess`.
 *
 * @returns {Promise<{edv, capability, invocationSigner}>}.
 */
export async function getProfileEdv({profileId, referenceIdPrefix}) {
  return caches.profileEdvs.memoize({
    key: 'profile-' + profileId,
    fn: () => _initProfileEdv({profileId, referenceIdPrefix})
  });
}

async function _initProfileEdv({profileId, referenceIdPrefix}) {
  const {edvClient: edv, capability, invocationSigner} = await profileManager
    .getProfileEdvAccess({profileId, referenceIdPrefix});
  return {edv, capability, invocationSigner};
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
