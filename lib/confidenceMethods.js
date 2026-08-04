/*!
 * Copyright (c) 2018-2026 Digital Bazaar, Inc.
 */
import * as didMethodKey from '@digitalbazaar/did-method-key';
import * as EcdsaMultikey from '@digitalbazaar/ecdsa-multikey';
import * as Ed25519Multikey from '@digitalbazaar/ed25519-multikey';
import {driver as DidJwkDriver} from '@digitalbazaar/did-method-jwk';

const didKeyDriver = didMethodKey.driver();
didKeyDriver.use({
  multibaseMultikeyHeader: 'z6Mk',
  fromMultibase: Ed25519Multikey.from
});
didKeyDriver.use({
  multibaseMultikeyHeader: 'zDna',
  fromMultibase: EcdsaMultikey.from
});
didKeyDriver.use({
  multibaseMultikeyHeader: 'z82L',
  fromMultibase: EcdsaMultikey.from
});
const didJwkDriver = DidJwkDriver();

export async function createConfidenceMethod({
  didMethod = 'key', algorithm = 'Ed25519'
} = {}) {
  // generate key pair
  let verificationKeyPair;
  if(algorithm.startsWith('P-')) {
    verificationKeyPair = await EcdsaMultikey.generate({curve: algorithm});
  } else {
    verificationKeyPair = await Ed25519Multikey.generate();
  }

  // convert to JWK
  let jwk;
  if(algorithm.startsWith('P-')) {
    jwk = await EcdsaMultikey.toJwk({
      keyPair: verificationKeyPair,
      secretKey: true
    });
  } else {
    jwk = await Ed25519Multikey.toJwk({
      keyPair: verificationKeyPair,
      secretKey: true
    });
  }
  delete jwk.ext;
  delete jwk.key_ops;

  // generate DID document
  let didDocument;
  if(didMethod === 'key') {
    ({didDocument} = await didKeyDriver.fromKeyPair({verificationKeyPair}));
  } else if(didMethod === 'jwk') {
    ({didDocument} = await didJwkDriver.fromJwk({jwk}));
  } else {
    const error = new Error(`Unsupported DID method "${didMethod}".`);
    error.name = 'NotSupportedError';
    throw error;
  }

  // set `id` and `controller` for verification method
  verificationKeyPair.id = didDocument.verificationMethod[0].id;
  verificationKeyPair.controller = didDocument.id;

  // create signer
  const signer = verificationKeyPair.signer();
  signer.id = verificationKeyPair.id;
  signer.controller = verificationKeyPair.controller;
  signer.algorithm = algorithm;

  // return confidence method
  return {
    id: didDocument.id,
    type: 'DecentralizedIdentifierDocument',
    signer,
    // include key access
    verificationKeyPair,
    multikey: await verificationKeyPair.export({secretKey: true}),
    jwk
  };
}

export async function importConfidenceMethod({confidenceMethod} = {}) {
  const type = confidenceMethod?.type;
  if(type !== 'DecentralizedIdentifierDocument') {
    throw new Error(`Unknown confidence method type "${type}".`);
  }

  let algorithm;
  let verificationKeyPair;
  if(confidenceMethod.jwk?.crv === 'Ed25519') {
    algorithm = confidenceMethod.jwk.crv;
    if(confidenceMethod.multikey) {
      verificationKeyPair = await Ed25519Multikey.from(
        confidenceMethod.multikey);
    } else {
      verificationKeyPair = await Ed25519Multikey.fromJwk({
        jwk: confidenceMethod.jwk, secretKey: true
      });
    }
  } else if(confidenceMethod.jwk?.crv?.startsWith('P-')) {
    algorithm = confidenceMethod.jwk.crv;
    if(confidenceMethod.multikey) {
      verificationKeyPair = await EcdsaMultikey.from(confidenceMethod.multikey);
    } else {
      verificationKeyPair = await EcdsaMultikey.fromJwk({
        jwk: confidenceMethod.jwk, secretKey: true
      });
    }
  } else {
    const error = new Error(
      `Unsupported confidence method "${confidenceMethod.jwk?.crv}".`);
    error.name = 'NotSupportedError';
    throw error;
  }

  if(!(verificationKeyPair.id && verificationKeyPair.controller)) {
    let didDocument;
    if(confidenceMethod.id?.startsWith?.('did:jwk:')) {
      ({didDocument} = await didJwkDriver.fromJwk({
        jwk: confidenceMethod.jwk
      }));
    } else {
      // default to `did:key`
      ({didDocument} = await didKeyDriver.fromKeyPair({
        verificationKeyPair
      }));
    }
    verificationKeyPair.id = didDocument.verificationMethod[0].id;
    verificationKeyPair.controller = didDocument.id;
  }

  let signer;
  if(verificationKeyPair.secretKeyMultibase) {
    signer = verificationKeyPair.signer();
    signer.id = verificationKeyPair.id;
    signer.controller = verificationKeyPair.controller;
    signer.algorithm = algorithm;
  }
  return {id: verificationKeyPair.controller, type, signer};
}
