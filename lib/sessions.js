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

async function initSessionStorage() {
  const promises = [];

  promises.push(store.create({
    id: 'profileEdvCache', object: profileEdvCache
  }));
  promises.push(store.create({
    id: 'remoteProfileVcStoreCache', object: remoteProfileVcStoreCache
  }));
  promises.push(store.create({
    id: 'localProfileVcStoreCache', object: localProfileVcStoreCache
  }));
  await Promise.all(promises);
}

export async function initSession() {
  const session = await getSession();
  const profileManager = await store.get({id: 'profileManager'});
  if(!profileManager) {
    const profileManager = new ProfileManager({
      edvBaseUrl: EDV_BASE_URL,
      kmsModule: KMS_MODULE,
      kmsBaseUrl: KMS_BASE_URL,
      recoveryHost: window.location.host
    });
    // 1. Ensure the profile manger is set in the web store
    // 2. Attach the profile manager to the session. Note, that parts of the
    //    software watches for changes in the session to retrieve the
    //    profile manager from the store. The profile manager MUST be set
    //    in the web store before incorporating it with the session.
    const promises = [];
    promises.push(store.create({id: 'profileManager', object: profileManager}));
    promises.push(profileManager.setSession({session}));
    promises.push(await initSessionStorage());
    await Promise.all(promises);
  }
  await session.refresh();
  return session;
}

export async function clearSession() {
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
