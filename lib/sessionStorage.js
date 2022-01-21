/*!
 * Copyright (c) 2021-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {LruCache} from '@digitalbazaar/lru-memoize';
import {store} from 'bedrock-web-store';
import {ProfileManager} from 'bedrock-web-profile-manager';
import {getSession} from 'bedrock-web-session';

const maxAge = 24 * 60 * 60 * 5000; // 24 hr
const profileEdvCache = new LruCache({maxAge});
const remoteProfileVcStoreCache = new LruCache({maxAge});
const localProfileVcStoreCache = new LruCache({maxAge});

const KMS_MODULE = 'ssm-v1';
const KMS_BASE_URL = `${window.location.origin}/kms`;
const EDV_BASE_URL = `${window.location.origin}/edvs`;

// FIXME: this method conflates the authn session with the server with
// session storage; needs to be better teased out and avoid confusion around
// how to interact with `getSession()` outside of this call
// can session storage initialization/reinitialization just
// be triggered backed on a change in session instead, removing the need for
// a developer to call it explicitly -- and removing the confusion?
export async function initialize() {
  // FIXME: this method doesn't protect against multiple concurrent calls
  // trying to create the profile manager
  const session = await getSession();
  const profileManager = await store.get({id: 'profileManager'});
  if(!profileManager) {
    const profileManager = new ProfileManager({
      edvBaseUrl: EDV_BASE_URL,
      kmsModule: KMS_MODULE,
      kmsBaseUrl: KMS_BASE_URL,
      recoveryHost: window.location.host
    });
    // 1. Ensure the profile manager is set in the web store
    // 2. Attach the profile manager to the session. Note, that parts of the
    //    software watches for changes in the session to retrieve the
    //    profile manager from the store. The profile manager MUST be set
    //    in the web store before incorporating it with the session.
    await _initStorage({profileManager});
    await profileManager.setSession({session});
  }
  await session.refresh();
  return session;
}

export async function clear() {
  const promises = [];

  promises.push(store.delete({id: 'profileManager'}));
  promises.push(store.delete({id: 'profileEdvCache'}));
  promises.push(store.delete({id: 'remoteProfileVcStoreCache'}));
  promises.push(store.delete({id: 'localProfileVcStoreCache'}));

  try {
    await Promise.all(promises);
  } catch(e) {
    console.log(e);
  }
}

async function _initStorage({profileManager}) {
  return Promise.all([
    store.create({id: 'profileManager', object: profileManager}),
    store.create({id: 'profileEdvCache', object: profileEdvCache}),
    store.create({
      id: 'remoteProfileVcStoreCache', object: remoteProfileVcStoreCache
    }),
    store.create({
      id: 'localProfileVcStoreCache', object: localProfileVcStoreCache
    })
  ]);
}
