/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from '@bedrock/web';
import {EdvClient} from '@digitalbazaar/edv-client';
import {Ed25519VerificationKey2020} from
  '@digitalbazaar/ed25519-verification-key-2020';
import {profileManager} from './state.js';

export const supportedProofTypes = new Map();
supportedProofTypes.set('Ed25519Signature2018');
supportedProofTypes.set('Ed25519Signature2020');

export async function createCapabilities({profileId, request}) {
  // TODO: validate `request`

  const {
    invocationTarget: target, invoker, delegator, referenceId, allowedAction
  } = request;
  let {parentCapability} = request;
  // FIXME: disallow `invoker` and `delegator`; `controller` is permitted
  const {controller = invoker || delegator} = request;

  const {defaults: defaultConfig} = config.wallet;

  // FIXME: use a specified key (requires user interaction and consent, do
  // not blindly generate one here for each zcap request) and then remove this
  // extra code that sets `invocationTarget.id`
  // FIXME: `invocationTarget` will not be an object in the near future, this
  // information about the type of key requested will need to be expressed
  // some other way
  const invocationTarget = {...target};

  if(invocationTarget.type === 'Ed25519VerificationKey2018' ||
    invocationTarget.type === 'Ed25519VerificationKey2020'
  ) {
    // FIXME: Instead of creating a new key for each capability
    // const {key, keyDescription, keystoreId} = await createKey({
    //   profileId,
    //   profileManager,
    //   type: 'Ed25519VerificationKey2018'
    // });

    // delegate the capability invocation key for now, in the future,
    // create a new key/use another key for the specific purpose
    // FIXME: Come back and fix this, after it's deployed
    const {invocationSigner} = await profileManager
      .getProfileSigner({profileId});
    invocationTarget.id = parentCapability =
      invocationSigner.capability.invocationTarget.id;

    // create public ID for zcap key
    const keyDescription = await invocationSigner.getKeyDescription();
    const keyPair = await Ed25519VerificationKey2020.from(keyDescription);
    const fingerprint = keyPair.fingerprint();

    if(profileId.includes('did:key:')) {
      invocationTarget.publicAlias =
        `did:key:${fingerprint}#${fingerprint}`;
    } else if(profileId.includes('did:v1')) {
      // FIXME: support other modes for v1, not just `test`
      invocationTarget.publicAlias =
        `did:v1:test:nym:${fingerprint}#${fingerprint}`;
    } else {
      // TODO: remove me and throw an error in the future instead
      console.log('Unsupported DID Method: ', profileId);
    }
  } else if(invocationTarget.type === 'urn:edv:documents') {
    // get meter for creating EDVs
    const {meters} = await profileManager.getMeters({profileId});
    const {meter: edvMeter} = meters.find(
      m => m.meter.referenceId === 'profile:core:edv');
    const {edvClient} = await profileManager.createProfileEdv({
      profileId,
      meterId: edvMeter.id,
      referenceId:
        `${encodeURIComponent(defaultConfig.edvBaseUrl)}:` +
        await EdvClient.generateId()
    });
    invocationTarget.id = `${edvClient.id}/documents`;
    if(!parentCapability) {
      parentCapability = `urn:zcap:root:${encodeURIComponent(edvClient.id)}`;
    }
  }

  const zcap = await profileManager.delegateCapability({
    profileId,
    request: {
      parentCapability, invocationTarget, controller, invoker, delegator,
      referenceId, allowedAction
    }
  });

  return [zcap];
}

// This createProfile helper:
// 1. creates a new profile (and its profileAgent)
// 2. creates a new users EDV
// 3. initializes access management for the profile which will create
//    user documents, one for the profile (using its `profileContent`)
//    and one for its profile agent (using its `profileAgentContent`)
// 4. creates a new credentials EDV
// 5. creates a new inbox EDV
// 6. stores capabilities to access capabilities EDV in the profileAgent
export const createProfile = async ({profileAgentContent, profileContent}) => {
  const t0 = Date.now();

  const {id: profileId, meters} = await profileManager.createProfile(
    profileContent);

  // get meter for creating EDVs
  const {meter: edvMeter} = meters.find(
    m => m.meter.referenceId === 'profile:core:edv');

  // create EDVs in parallel; can be done before initializing access management
  const [
    {edvClient: usersEdvClient},
    {edvClient: credentialsEdvClient},
    {edvClient: inboxEdvClient},
  ] = await Promise.all([
    // create a `users` EDV for the profile to handle access management
    profileManager.createProfileEdv({
      profileId, meterId: edvMeter.id,
      referenceId: config.wallet.defaults.edvs.users
    }),
    // create a `credentials` EDV for the profile
    profileManager.createProfileEdv({
      profileId, meterId: edvMeter.id,
      referenceId: config.wallet.defaults.edvs.credentials
    }),
    // create an `inbox` EDV for the profile
    profileManager.createProfileEdv({
      profileId, meterId: edvMeter.id,
      referenceId: config.wallet.defaults.edvs.inbox
    })
  ]);

  const {invocationSigner, profileAgent: {id: profileAgentId}} =
    await profileManager.getProfileSigner({profileId});

  // initialize access management and delegate EDV zcaps can be done
  // in parallel
  const [
    {profile, profileAgent},
    {zcaps: credentialsEdvZcaps},
    {zcaps: inboxEdvZcaps},
  ] = await Promise.all([
    profileManager.initializeAccessManagement({
      profileId, profileContent,
      edvId: usersEdvClient.id,
      hmac: usersEdvClient.hmac,
      keyAgreementKey: usersEdvClient.keyAgreementKey,
      indexes: [
        {attribute: 'content.name'},
        {attribute: 'content.email'}
      ]
    }),
    profileManager.delegateEdvCapabilities({
      edvId: credentialsEdvClient.id,
      hmac: credentialsEdvClient.hmac,
      keyAgreementKey: credentialsEdvClient.keyAgreementKey,
      edvClient: credentialsEdvClient,
      invocationSigner,
      profileAgentId,
      referenceIdPrefix: config.wallet.defaults.edvs.credentials
    }),
    profileManager.delegateEdvCapabilities({
      edvId: inboxEdvClient.id,
      hmac: inboxEdvClient.hmac,
      keyAgreementKey: inboxEdvClient.keyAgreementKey,
      edvClient: inboxEdvClient,
      invocationSigner,
      profileAgentId,
      referenceIdPrefix: config.wallet.defaults.edvs.inbox
    })
  ]);

  // create user content for profile agent, preserving zcaps
  const {zcaps} = profileAgent;
  let user = {
    ...profileAgent,
    ...profileAgentContent,
    zcaps: {...zcaps, ...(profileAgentContent.zcaps || {})}
  };

  // add zcaps to profile agent to use profile's credentials EDV
  for(const [referenceId, zcap] of Object.entries(credentialsEdvZcaps)) {
    user.zcaps[referenceId] = zcap;
  }

  // add zcaps to profile agent to use profile's inbox EDV
  for(const [referenceId, zcap] of Object.entries(inboxEdvZcaps)) {
    user.zcaps[referenceId] = zcap;
  }

  // update profile agent user with content and new zcaps
  const accessManager = await profileManager.getAccessManager({profileId});
  user = await accessManager.updateUser({user});

  const t1 = Date.now();
  console.log('profile creation time', t1 - t0, 'ms');

  return {profileAgent: user, profile};
};

export async function openFirstPartyWindow(event) {
  const url = `${window.location.origin}/credential-handler/register`;
  const width = 500;
  const height = 400;
  let left;
  let top;
  if(event) {
    left = event.screenX - (width / 2);
    top = event.screenY - (height / 2);
  } else {
    left = (window.innerWidth - width) / 2;
    top = (window.innerHeight - height) / 2;
  }
  const features =
    'menubar=no,location=no,resizable=no,scrollbars=no,status=no,' +
    `width=${width},height=${height},left=${left},top=${top}`;

  return window.open(url, 'register', features);
}

export const prettify = obj => JSON.stringify(obj, null, 2);
