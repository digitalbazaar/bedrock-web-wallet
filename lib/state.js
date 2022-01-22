/*!
 * Copyright (c) 2021-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {LruCache} from '@digitalbazaar/lru-memoize';
import {ProfileManager} from 'bedrock-web-profile-manager';
import {getSession} from 'bedrock-web-session';

const MAX_AGE = 24 * 60 * 60 * 5000; // 24 hr
const KMS_MODULE = 'ssm-v1';
const KMS_BASE_URL = `${window.location.origin}/kms`;
const EDV_BASE_URL = `${window.location.origin}/edvs`;

let _initialized = false;

export const caches = {};
export let profileManager;

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
  const session = await getSession();
  await profileManager.setSession({session});

  // create caches
  caches.profileEdvs = new LruCache({maxAge: MAX_AGE});
  caches.remoteProfileVcStores = new LruCache({maxAge: MAX_AGE});
  caches.localProfileVcStores = new LruCache({maxAge: MAX_AGE});

  // reset internal state when session changes
  session.on('change', _reset);
}

async function _reset() {
  for(const cache of Object.values(caches)) {
    cache.cache.reset();
  }
}
