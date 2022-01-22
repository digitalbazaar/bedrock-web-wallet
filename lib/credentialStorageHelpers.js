/*!
 * Copyright (c) 2018-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {caches, profileManager} from './state.js';
import {EdvClient} from 'edv-client';

/*
 * @returns {Promise<{edv: EdvClient, invocationSigner}>}
 */
export async function getProfileEdv({profileId, referenceIdPrefix}) {
  return caches.profileEdvs.memoize({
    key: 'profile-' + profileId,
    fn: () => _initProfileEdv({profileId, referenceIdPrefix})
  });
}

// TODO: replace with proper use of zcaps, etc.
async function _initProfileEdv({profileId, referenceIdPrefix}) {
  // FIXME: consider destructuring `invocationSigner` in return value here
  // as well and just returning `edv` and `invocationSigner` without rebuilding
  // the other values
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
