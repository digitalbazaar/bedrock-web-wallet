/*!
 * Copyright (c) 2019-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {Ed25519VerificationKey2018} from
  '@digitalbazaar/ed25519-verification-key-2018';
import {Ed25519VerificationKey2020} from
  '@digitalbazaar/ed25519-verification-key-2020';
import {profileManager} from './state.js';

const SUPPORTED_KEY_PAIRS = new Map();
SUPPORTED_KEY_PAIRS.set(
  'Ed25519VerificationKey2018', Ed25519VerificationKey2018);
SUPPORTED_KEY_PAIRS.set(
  'Ed25519VerificationKey2020', Ed25519VerificationKey2020);

export async function createCapability({profileId, request}) {
  // TODO: validate `request`

  const {
    parentCapability, invocationTarget: target, controller, invoker, delegator,
    referenceId, allowedAction, caveat
  } = request;
  if(invoker) {
    throw new Error('"invoker" is not allowed; use "controller" instead.');
  }
  if(delegator) {
    throw new Error('"delegator" is not allowed; use "controller" instead.');
  }
  if(!controller) {
    throw new Error('"controller" is required.');
  }

  // FIXME: use a specified key (requires user interaction and consent, do
  // not blindly generate one here for each zcap request) and then remove this
  // extra code that sets `invocationTarget.id`
  const invocationTarget = {...target};
  const KeyPair = SUPPORTED_KEY_PAIRS.get(invocationTarget.type);

  if(KeyPair) {
    const {key, keyDescription} = await createKey(
      {type: invocationTarget.type});
    invocationTarget.id = key.id;

    // create public ID (did:key) for zcap key
    // TODO: do not use did:key but support a did:v1 based key.
    const keyPair = await KeyPair.from(keyDescription);
    const fingerprint = keyPair.fingerprint();
    invocationTarget.publicAlias =
      `did:key:${fingerprint}#${fingerprint}`;
  }

  return profileManager.delegateCapability({
    profileId,
    request: {
      parentCapability, invocationTarget, controller, referenceId,
      allowedAction, caveat
    }
  });
}

// eslint-disable-next-line no-unused-vars
async function createKey({type, proofPurpose}) {
  const {keystoreAgent} = profileManager;
  if(!keystoreAgent) {
    throw new Error('Unable to find keystore agent for account.');
  }
  const key = await keystoreAgent.generateKey({type});

  // FIXME: this only works for AsymmetricKeys
  const keyDescription = await key.getKeyDescription();

  // TODO: Add key to DID Document for the designated proof purpose
  return {key, keyDescription};
}

export function generateDescription(zcap) {
  const {invocationTarget, allowedAction, delegator} = zcap;
  const {type, proofPurpose} = invocationTarget;
  if(type === 'urn:edv:document' || type === 'urn:edv:documents') {
    const actions = !Array.isArray(allowedAction) ? [allowedAction] :
      allowedAction;
    if(delegator) {
      actions.push('delegate');
    }
    const subheading = actions.join(', ');
    return {
      heading: 'Store application data.',
      subheading,
      ...zcap
    };
  } else if(type === 'Ed25519VerificationKey2020') {
    const proofPurposeMap = {
      assertionMethod: 'Issue credentials on your behalf.'
    };
    const actions = !Array.isArray(allowedAction) ? [allowedAction] :
      allowedAction;
    if(delegator) {
      actions.push('delegate');
    }
    const heading = proofPurposeMap[proofPurpose];
    const subheading = actions.join(', ').toLowerCase();
    return {
      heading,
      subheading,
      ...zcap
    };
  } else {
    const actions = !Array.isArray(allowedAction) ? [allowedAction] :
      allowedAction;
    if(delegator) {
      actions.push('delegate');
    }
    const subheading = actions.join(', ');
    return {
      heading: 'Unrecognized capability!',
      subheading,
      ...zcap
    };
  }
}
