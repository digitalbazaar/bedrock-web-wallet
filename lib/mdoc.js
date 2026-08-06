/*!
 * Copyright (c) 2018-2026 Digital Bazaar, Inc.
 */
import {
  CoseKey, DeviceRequest, DocRequest, Holder,
  IssuerSigned, ItemsRequest, SessionTranscript
} from '@owf/mdoc';
import {base64ToBytes} from './util.js';
import {importConfidenceMethod} from './confidenceMethods.js';
import {oid4vp} from '@digitalbazaar/oid4-client';
import {parseEnvelope} from './envelopes.js';
import {selectJsonLd} from '@digitalbazaar/di-sd-primitives';

const MDL_NAMESPACE = 'org.iso.18013.5.1';
const MDOC_TYPE_MDL = `${MDL_NAMESPACE}.mDL`;

const VC_CONTEXT_2 = 'https://www.w3.org/ns/credentials/v2';

const {encodeSessionTranscript} = oid4vp.mdl;

export async function deriveMdocMdlCredential({
  requestOrigin, /* verifiablePresentationRequest, */
  verifiableCredential, envelope, meta, pointers
} = {}) {
  const {mediaType} = envelope;
  if(mediaType !== 'application/mdl') {
    const error = new Error(
      'Could not derive credential; unsupported envelope media type ' +
      `"${mediaType}".`);
    error.name = 'NotSupportedError';
    throw error;
  }

  try {
    // parse `issuerSigned` from envelope
    const parsed = parseEnvelope({envelope: envelope.credential});
    const encodedIssuerSigned = base64ToBytes({base64String: parsed.content});
    const issuerSigned = IssuerSigned.decode(encodedIssuerSigned);

    // create mdoc mDL device response...

    // get confidence method to use as device key
    const confidenceMethod = await importConfidenceMethod({
      confidenceMethod: meta.confidenceMethods[0]
    });

    // create an Annex D mDL handover (presently the only supported handover)
    const handover = {
      type: 'OpenID4VPDCAPIHandover',
      origin: requestOrigin,
      nonce: globalThis.crypto.randomUUID(),
      // FIXME: expected to be an OID4VP key (ECDH-ES) used to encrypt the
      // response, it is not the device key
      recipientPublicJwk: confidenceMethod.publicJwk
    };

    // parse DL fields from pointers
    const fields = {};
    for(const pointer of pointers) {
      if(!pointer.startsWith('/credentialSubject/driversLicense/') ||
        pointer === '/credentialSubject/driversLicense/type') {
        continue;
      }
      const field = pointer.split('/')[2];
      fields[field] = true;
    }

    console.log('Deriving mdoc mDL device response from:', {pointers, fields});

    // prepare device request
    const deviceRequest = DeviceRequest.create({
      docRequests: [DocRequest.create({
        itemsRequest: ItemsRequest.create({
          docType: MDOC_TYPE_MDL,
          namespaces: {
            [MDL_NAMESPACE]: fields
          }
        })
      })]
    });

    // create transcript
    const encodedSessionTranscript = await encodeSessionTranscript({handover});
    const sessionTranscript = SessionTranscript.decode(
      encodedSessionTranscript);

    // create device response
    const mdocContext = _createMdocContext({signer: confidenceMethod.signer});
    const deviceResponse = await Holder.createDeviceResponseForDeviceRequest({
      deviceRequest,
      issuerSigned: [issuerSigned],
      sessionTranscript,
      signature: {signingKey: CoseKey.fromJwk(confidenceMethod.privateJwk)}
    }, mdocContext);

    // express `vpToken` in derived envelope
    const vpToken = deviceResponse.encodedForOid4Vp;
    const derivedEnvelope = {
      '@context': [VC_CONTEXT_2],
      id: `data:application/mdl-vp-token,${vpToken}`,
      type: 'EnvelopedVerifiablePresentation'
    };

    // return derived VC and derived envelope
    const derivedCredential = selectJsonLd({
      document: verifiableCredential,
      pointers
    });
    return {
      derivedCredential,
      derivedEnvelope: {
        credential: derivedEnvelope,
        mediaType: 'application/mdl-vp-token'
      }
    };
  } catch(error) {
    console.log('Error trying to derive credential and envelope: ', {error});
  }
}

// constructs an "mdoc context" based on the given `signer` and that implements
// the other necessary `digest` and `random` functions
function _createMdocContext({signer}) {
  const crypto = globalThis.crypto;
  return {
    crypto: {
      async digest({digestAlgorithm, bytes}) {
        const digest = await crypto.subtle.digest(digestAlgorithm, bytes);
        return new Uint8Array(digest);
      },
      random(length) {
        return crypto.getRandomValues(new Uint8Array(length));
      }
    },
    cose: {
      sign1: {
        async sign(input) {
          const {toBeSigned} = input;
          return signer.sign({data: toBeSigned});
        }
      }
    }
  };
}
