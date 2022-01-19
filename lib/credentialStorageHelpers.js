/*!
 * Copyright (c) 2018-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {EdvClient} from 'edv-client';
import {getProfileManager} from './profileManager.js';
import {store as defaultStore} from 'bedrock-web-store';

/*
 * @returns {Promise<{edv: EdvClient, invocationSigner}>}
 */
export async function getProfileEdv({profileId, referenceIdPrefix}) {
  const profileEdvCache = await defaultStore.get({id: 'profileEdvCache'});
  return profileEdvCache.memoize({
    key: 'profile-' + profileId,
    fn: () => initProfileEdv({profileId, referenceIdPrefix})
  });
}

// TODO: replace with proper use of zcaps, etc.
export async function initProfileEdv({profileId, referenceIdPrefix}) {
  const profileManager = await getProfileManager();
  const {edvClient, capability} = await profileManager.getProfileEdvAccess(
    {profileId, referenceIdPrefix});
  const [{invocationSigner}, keystoreAgent] = await Promise.all([
    profileManager.getProfileSigner({profileId}),
    profileManager.getProfileKeystoreAgent({profileId})
  ]);
  const [keyAgreementKey, hmac] = await Promise.all([
    keystoreAgent.getKeyAgreementKey({
      id: edvClient.keyAgreementKey.id,
      type: edvClient.keyAgreementKey.type
    }),
    keystoreAgent.getHmac({
      id: edvClient.hmac.id,
      type: edvClient.hmac.type
    })
  ]);
  // remove `/documents` to get edv ID
  const edvId = capability.invocationTarget.id.substr(
    0, capability.invocationTarget.id.length - 10);
  const edv = new EdvClient({
    id: edvId,
    keyResolver: edvClient.keyResolver,
    keyAgreementKey,
    hmac,
  });
  return {edv, invocationSigner};
}
