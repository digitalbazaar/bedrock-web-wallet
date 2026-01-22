/*!
 * Copyright (c) 2020-2026 Digital Bazaar, Inc. All rights reserved.
 */
import * as base58 from 'base58-universal';
import * as base64url from 'base64url-universal';
import {config} from '@bedrock/web';
import {
  Ed25519VerificationKey2020
} from '@digitalbazaar/ed25519-verification-key-2020';
import {EdvClient} from '@digitalbazaar/edv-client';
import {profileManager} from './state.js';

const supportedSignerTypes = new Map([
  ['Ed25519VerificationKey2020', ['Ed25519Signature2020', 'eddsa-rdfc-2022']]
]);

const multibaseDecoders = new Map([
  ['u', base64url],
  ['z', base58],
]);

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

  if(invocationTarget.type === 'Ed25519VerificationKey2020') {
    // FIXME: Instead of creating a new key for each capability
    // const {key, keyDescription, keystoreId} = await createKey({
    //   profileId,
    //   profileManager,
    //   type: 'Ed25519VerificationKey2020'
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

    if(profileId.startsWith('did:key:')) {
      invocationTarget.publicAlias =
        `did:key:${fingerprint}#${fingerprint}`;
    } else if(profileId.startsWith('did:v1:')) {
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
export const createProfile = async ({
  profileAgentContent, profileContent, profileOptions
}) => {
  const t0 = Date.now();

  const {id: profileId} = await profileManager.createProfile(profileOptions);

  // update profile and profile agent user with content
  const {
    accessManager, profile, profileAgent
  } = await profileManager.getAccessManager({profileId});
  const [user] = await Promise.all([
    profileAgentContent && _updateProfileAgentUser(
      {accessManager, profileAgent, profileAgentContent}),
    profileContent && _updateProfileUser(
      {accessManager, profileId, profileContent})
  ]);

  let updatedProfile = profile;
  // if profile content was provided, kick off request to update cache
  if(profileContent) {
    // set `useCache: false` to fetch a fresh copy
    profileManager.getProfile({id: profileId, useCache: false})
      .catch(() => {});
    updatedProfile = _mergeProfileContent({
      profile, profileContent
    });
  }

  const t1 = Date.now();

  return {
    profileAgent: user || profileAgent,
    profile: updatedProfile,
    stats: {
      creationTimeMs: t1 - t0
    }
  };
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

export async function toNFCPayload({credential}) {
  const nfcRenderingTemplate2024 = _getNFCRenderingTemplate2024({credential});
  const bytes = await _decodeMultibase(nfcRenderingTemplate2024.payload);
  return {bytes};
}

export function hasNFCPayload({credential}) {
  try {
    const nfcRenderingTemplate2024 = _getNFCRenderingTemplate2024({credential});
    if(!nfcRenderingTemplate2024) {
      return false;
    }

    return true;
  } catch(e) {
    return false;
  }
}

function _getNFCRenderingTemplate2024({credential}) {
  let {renderMethod} = credential;
  if(!renderMethod) {
    throw new Error('Credential does not contain "renderMethod".');
  }

  renderMethod = Array.isArray(renderMethod) ? renderMethod : [renderMethod];

  let nfcRenderingTemplate2024 = null;
  for(const rm of renderMethod) {
    if(rm.type === 'NfcRenderingTemplate2024') {
      nfcRenderingTemplate2024 = rm;
      break;
    }
    continue;
  }

  if(nfcRenderingTemplate2024 === null) {
    throw new Error('Credential does not support "NfcRenderingTemplate2024".');
  }

  if(!nfcRenderingTemplate2024.payload) {
    throw new Error('NfcRenderingTemplate2024 does not contain "payload".');
  }

  return nfcRenderingTemplate2024;
}

async function _decodeMultibase(input) {
  const multibaseHeader = input[0];
  const decoder = multibaseDecoders.get(multibaseHeader);
  if(!decoder) {
    throw new Error(`Multibase header "${multibaseHeader}" not supported.`);
  }

  const encodedStr = input.slice(1);
  return decoder.decode(encodedStr);
}

async function _updateProfileAgentUser({
  accessManager, profileAgent, profileAgentContent
}) {
  return accessManager.updateUser({
    id: profileAgent.id,
    async mutator({existing}) {
      const updatedDoc = {...existing};
      // add profile agent content
      updatedDoc.content = _mergeProfileAgentContent({
        profileAgent: updatedDoc.content, profileAgentContent
      });
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
      // add profile content
      updatedDoc.content = _mergeProfileContent({
        profile: updatedDoc.content, profileContent
      });
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

function _mergeContent({target, content, existingTypes} = {}) {
  return {
    ...content,
    ...target,
    // special handle type to include required types
    type: _addTypes({
      existingTypes,
      newTypes: content.type
    }),
    // special handle zcaps to avoid overwrites
    zcaps: {
      ...target.zcaps,
      ...content.zcaps
    }
  };
}

function _mergeProfileContent({profile, profileContent} = {}) {
  return _mergeContent({
    target: profile, content: profileContent,
    existingTypes: ['User', 'Profile']
  });
}

function _mergeProfileAgentContent({profileAgent, profileAgentContent} = {}) {
  return _mergeContent({
    target: profileAgent, content: profileAgentContent,
    existingTypes: ['User', 'Agent']
  });
}

export function _checkSignerType({acceptedProofTypes, signer}) {
  const signerTypes = supportedSignerTypes.get(signer.type);
  if(!acceptedProofTypes.some(({name}) => signerTypes.includes(name))) {
    acceptedProofTypes =
      acceptedProofTypes.map(type => type.name).join(', ');
    throw new Error(
      'No supported cryptosuite matches one of the accepted cryptosuites ' +
      `(${acceptedProofTypes})`);
  }
}
