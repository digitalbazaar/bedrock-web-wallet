/*!
 * Copyright (c) 2019-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {getProfileManager} from './profileManager.js';
import {Ed25519VerificationKey2018} from
  '@digitalbazaar/ed25519-verification-key-2018';
import {Ed25519VerificationKey2020} from
  '@digitalbazaar/ed25519-verification-key-2020';
const KMS_MODULE = 'ssm-v1';

const SUPPORTED_KEY_PAIRS = new Map();
SUPPORTED_KEY_PAIRS.set(
  'Ed25519VerificationKey2018', Ed25519VerificationKey2018);
SUPPORTED_KEY_PAIRS.set(
  'Ed25519VerificationKey2020', Ed25519VerificationKey2020);

export async function createCapability({profileId, request}) {
  const profileManager = await getProfileManager();

  // TODO: validate `request`

  const {
    parentCapability, invocationTarget: target, invoker, delegator,
    referenceId, allowedAction, caveat
  } = request;

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
      parentCapability, invocationTarget, invoker, delegator, referenceId,
      allowedAction, caveat
    }
  });
}

// eslint-disable-next-line no-unused-vars
async function createKey({type, proofPurpose}) {
  const profileManager = await getProfileManager();
  const {keystoreAgent} = profileManager;
  if(!keystoreAgent) {
    throw new Error('Unable to find keystore agent for account.');
  }
  const key = await keystoreAgent.generateKey({type, kmsModule: KMS_MODULE});

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
