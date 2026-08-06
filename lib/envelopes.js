/*!
 * Copyright (c) 2020-2026 Digital Bazaar, Inc.
 */
import {base64ToBytes} from './util.js';
import {importConfidenceMethod} from './confidenceMethods.js';
import {IssuerSigned} from '@owf/mdoc';

// polyfill required for `@peculiar/x509`
import 'reflect-metadata/lite';

// import after `reflect-metadata/lite` polyfill
import {X509Certificate} from '@peculiar/x509';

const MDL_NAMESPACE = 'org.iso.18013.5.1';
const MDOC_TYPE_MDL = `${MDL_NAMESPACE}.mDL`;

const VC_V2_CONTEXT_URL = 'https://www.w3.org/ns/credentials/v2';

const SUPPORTED_MEDIA_TYPES = new Set([
  'application/mdl'
]);

export function parseEnvelope({envelope} = {}) {
  const {id} = envelope;
  const format = {};
  const comma = id?.indexOf(',');
  if(id?.startsWith?.('data:') && comma !== -1) {
    const mediaType = id.slice('data:'.length, comma);
    const parts = mediaType.split(';');
    format.mediaType = mediaType;
    format.typeAndSubType = parts.shift();
    const [type, subType] = format.typeAndSubType.split('/');
    format.type = type;
    format.subType = subType;
    format.parameters = new Map(parts.map(s => s.trim().split('=')));
  }
  return {content: id?.slice?.(comma + 1), format};
}

export async function transformEnvelopedCredential({credential, meta} = {}) {
  if(credential['@context'] !== VC_V2_CONTEXT_URL) {
    throw new Error(`"credential.@context" must be "${VC_V2_CONTEXT_URL}".`);
  }
  if(credential.type !== 'EnvelopedVerifiableCredential') {
    throw new Error('"credential.type" must be "EnvelopedVerifiableCredential');
  }
  const parsed = parseEnvelope({envelope: credential});
  const mediaType = parsed.format.typeAndSubType;
  if(!SUPPORTED_MEDIA_TYPES.has(mediaType)) {
    const error = new Error(`Envelope format "${mediaType}" not supported.`);
    error.name = 'NotSupportedError';
    throw error;
  }

  // handle supported envelope types
  let result;
  if(mediaType === 'application/mdl') {
    result = await transformMdocMdl({envelope: credential, parsed});
  }

  const envelope = {credential, mediaType, meta: result.meta};

  return {
    credential: result.verifiableCredential,
    meta: {envelope, ...meta}
  };
}

async function transformMdocMdl({parsed}) {
  const {content, format} = parsed;

  if(!format.parameters.has('base64')) {
    const error = new Error(
      'Mobile document mDL envelope content must a base64-encoded.');
    error.name = 'NotSupportedError';
    throw error;
  }

  // parser envelope content
  const encodedIssuerSigned = base64ToBytes({base64String: content});

  // decode `issuerSigned`
  const issuerSigned = IssuerSigned.decode(encodedIssuerSigned);

  // ensure MSO is a supported type (mDL)
  const mso = issuerSigned?.issuerAuth?.mobileSecurityObject;
  const docType = mso?.docType;
  if(docType !== MDOC_TYPE_MDL) {
    const error = new Error(
      `Mobile document mDL envelope contents doc type of "${docType}" is ` +
      `not supported; it must be "${MDOC_TYPE_MDL}".`);
    error.name = 'NotSupportedError';
    throw error;
  }

  // @owf/mdoc decodes nested CBOR maps as JS Map instances; convert to
  // plain objects
  const rawFields = issuerSigned.getPrettyClaims(MDL_NAMESPACE);
  const driversLicense = _deepMapToObject(rawFields);

  // import issuer's public key as a confidence method to generate an issuer
  // DID; throw the public key type is unsupported
  const certificate = new X509Certificate(issuerSigned.issuerAuth.certificate);
  const issuerJwk = await globalThis.crypto.subtle.exportKey(
    'jwk', await certificate.publicKey.export());
  const {id: issuerId} = await importConfidenceMethod({
    confidenceMethod: {
      type: 'DecentralizedIdentifierDocument',
      jwk: issuerJwk
    }
  });
  const issuer = {
    id: issuerId,
    name: certificate.subjectName.getField('CN')?.[0] ??
      driversLicense.issuing_authority
  };

  // get validity period from MSO
  const validFrom = _toDateTime({date: mso.validityInfo.validFrom});
  const validUntil = _toDateTime({date: mso.validityInfo.validUntil});

  // generate vDL
  const verifiableCredential = _createVdl({
    issuer, validFrom, validUntil, driversLicense
  });
  const meta = {docType};
  return {verifiableCredential, meta};
}

function _createVdl({issuer, validFrom, validUntil, driversLicense}) {
  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://w3id.org/vdl/v1',
      'https://w3id.org/vdl/aamva/v1'
    ],
    type: [
      'VerifiableCredential',
      'Iso18013DriversLicenseCredential'
    ],
    name: `Mobile Driver's License`,
    description: 'A license granting driving privileges.',
    issuer,
    validFrom,
    validUntil,
    credentialSubject: {
      type: 'LicensedDriver',
      driversLicense: {
        type: 'Iso18013DriversLicense',
        ...driversLicense
      }
    }
  };
}

function _deepMapToObject(value) {
  // handle native Map
  if(value instanceof Map) {
    const obj = {};
    for(const [k, v] of value) {
      obj[k] = _deepMapToObject(v);
    }
    return obj;
  }
  // handle @owf/mdoc's TypedMap, which wraps a native Map in a .map property
  if(value?.map instanceof Map) {
    const obj = {};
    for(const [k, v] of value.map) {
      obj[k] = _deepMapToObject(v);
    }
    return obj;
  }
  if(Array.isArray(value)) {
    return value.map(_deepMapToObject);
  }
  // recurse into plain objects so nested Maps are converted
  if(value !== null && typeof value === 'object') {
    const obj = {};
    for(const [k, v] of Object.entries(value)) {
      obj[k] = _deepMapToObject(v);
    }
    return obj;
  }
  return value;
}

function _toDateTime({date}) {
  return date.toISOString().replace(/\.\d+Z$/, 'Z');
}
