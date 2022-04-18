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
    invocationTarget: target, controller,
    invoker, delegator, allowedAction,
    allowedActions = allowedAction
  } = request;
  let {parentCapability} = request;
  if(invoker || delegator) {
    throw new Error(
      '"invoker" and "delegator" are no longer supported, use "controller".');
  }

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
      capability: parentCapability, invocationTarget,
      controller, allowedActions
    }
  });

  return [zcap];
}

// This `createProfile` helper:
// 1. Creates a new profile (and its profile agent).
// 2. Updates the profile user document with `profileContent`.
// 3. Updates the profile agent user document with `profileAgentContent`.
export const createProfile = async ({profileAgentContent, profileContent}) => {
  const t0 = Date.now();

  const {id: profileId} = await profileManager.createProfile(profileContent);

  // update profile and profile agent user with content
  const {accessManager, profile, profileAgent} = await profileManager
    .getAccessManager({profileId});
  const [user] = await Promise.all([
    profileAgentContent && _updateProfileAgentUser(
      {accessManager, profileAgent, profileAgentContent}),
    profileContent && _updateProfileUser(
      {accessManager, profileId, profileContent})
  ]);

  const t1 = Date.now();
  console.log('profile creation time', t1 - t0, 'ms');

  return {profileAgent: user || profileAgent, profile};
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

async function _updateProfileAgentUser({
  accessManager, profileAgent, profileAgentContent
}) {
  return accessManager.updateUser({
    id: profileAgent.id,
    async mutator({existing}) {
      const updatedDoc = {...existing};

      // add profile agent content
      updatedDoc.content = {
        ...updatedDoc.content,
        ...profileAgentContent,
        // special handle type to include required types
        type: _addTypes({
          existingTypes: ['User', 'Agent'],
          newTypes: profileAgentContent.type
        }),
        // special handle zcaps to avoid overwrites
        zcaps: {
          ...updatedDoc.content.zcaps,
          ...profileAgentContent.zcaps
        }
      };
      return updatedDoc;
    }
  });
}

async function _updateProfileUser({
  accessManager, profileId, profileContent
}) {
  return accessManager.updateUser({
    id: profileId,
    async mutator({existing}) {
      const updatedDoc = {...existing};

      // add profile agent content
      updatedDoc.content = {
        ...updatedDoc.content,
        ...profileContent,
        // special handle type to include required types
        type: _addTypes({
          existingTypes: ['User', 'Profile'],
          newTypes: profileContent.type
        }),
        // special handle zcaps to avoid overwrites
        zcaps: {
          ...updatedDoc.content.zcaps,
          ...profileContent.zcaps
        }
      };
      return updatedDoc;
    }
  });
}

function _addTypes({existingTypes, newTypes}) {
  const types = new Set(existingTypes);
  if(typeof newTypes === 'string') {
    types.add(newTypes);
  } else if(Array.isArray(newTypes)) {
    newTypes.forEach(types.add.bind(types));
  }
  return [...types];
}
