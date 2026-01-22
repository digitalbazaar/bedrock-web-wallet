/*!
 * Copyright (c) 2025-2026 Digital Bazaar, Inc. All rights reserved.
 */

/**
 * VC NFC Renderer Library
 * Handles NFC rendering for verifiable credentials.
 * Supports both static and dynamic rendering modes.
 *
 * Field Requirements:
 * - TemplateRenderMethod (W3C spec): MUST use "template" field.
 * - NfcRenderingTemplate2024 (legacy): MUST use "payload" field.
 */
import * as base58 from 'base58-universal';
import * as base64url from 'base64url-universal';
import {base64ToBytes} from './util.js';
import {selectJsonLd} from '@digitalbazaar/di-sd-primitives';

const multibaseDecoders = new Map([
  ['u', base64url],
  ['z', base58]
]);

// ============
// Public API
// ============

/**
 * Check if a verifiable credential supports NFC rendering.
 *
 * @param {object} options - Options object.
 * @param {object} options.credential - The verifiable credential.
 * @returns {boolean} - 'true' if NFC is supported.
 */
export function supportsNfc({credential} = {}) {
  try {
    const renderMethod = _findNfcRenderMethod({credential});

    // return whether any NFC render method was found
    return renderMethod !== null;
  } catch(error) {
    return false;
  }
}

/**
 * Render a verifiable credential to NFC payload bytes.
 *
 * Architecture:
 *
 * 1. Filter: Use renderProperty to extract specific fields
 *  (optional, for transparency).
 * 2. Render: Pass template and filtered data to NFC rendering engine.
 * 3. Output: Return decoded bytes from template.
 *
 * Template Requirement:
 * - All NFC rendering requires a template field containing pre-encoded payload.
 * - TemplateRenderMethod uses 'template' field (W3C spec).
 * - NfcRenderingTemplate2024 uses 'payload' field (legacy).
 *
 * @param {object} options - Options object.
 * @param {object} options.credential - The verifiable credential.
 * @returns {Promise<object>} Object with bytes property: {bytes: Uint8Array}.
 */
export async function renderToNfc({credential} = {}) {
  // finc NFC-compatible render method
  const renderMethod = _findNfcRenderMethod({credential});

  if(!renderMethod) {
    throw new Error(
      'The verifiable credential does not support NFC rendering.');
  }

  // require template/payload field (safety check - should not reach here
  // as _findNfcRenderMethod only returns valid methods)
  if(!_hasTemplate({renderMethod})) {
    throw new Error('NFC render method is missing the "template" field.');
  }

  // Step 1: Filter credential if renderProperty exists
  let filteredData = null;
  if(renderMethod.renderProperty && renderMethod.renderProperty.length > 0) {
    filteredData = _filterCredential({credential, renderMethod});
  }

  // Step 2: Pass both template and filteredData to rendering engine
  const bytes = await _decodeTemplateToBytes({renderMethod, filteredData});

  // Wrap in object for consistent return format
  return {bytes};
}

// ========================
// Render method detection
// ========================

/**
 * Check if render method has a template field.
 *
 * Note: Template field name varies by type:
 * - TemplateRenderMethod: uses 'template' field (W3C spec).
 * - NfcRenderingTemplate2024: uses 'payload' field (legacy).
 *
 * @private
 * @param {object} options - Options object.
 * @param {object} options.renderMethod - The render method object.
 * @returns {boolean} - 'true' if template or payload field exists.
 */
function _hasTemplate({renderMethod} = {}) {
  // enforce field usage based on render method type
  if(renderMethod.type === 'TemplateRenderMethod') {
    // W3C Spec format: check for 'template' field
    return renderMethod?.template !== undefined;
  }

  if(renderMethod.type === 'NfcRenderingTemplate2024') {
    // legacy format: check for 'payload' field
    return renderMethod?.payload !== undefined;
  }

  return false;
}

/**
 * Filter credential data using renderProperty.
 * Extracts only the fields specified in renderProperty
 * for transparency.
 *
 * @private
 * @param {object} options - Options object.
 * @param {object} options.credential - The verifiable credential.
 * @param {object} options.renderMethod - The render method object.
 * @returns {object} - Filtered data object with extracted fields.
 */
function _filterCredential({credential, renderMethod} = {}) {
  const {renderProperty} = renderMethod;

  // check if renderProperty exists and is not empty
  if(!(renderProperty?.length > 0)) {
    return null;
  }

  return selectJsonLd({
    document: credential,
    pointers: renderProperty
  });
}

/**
 * Find the NFC-compatible render method in a verifiable credential.
 * Checks modern format (TemplateRenderMethod) first, then legacy
 * format (NfcRenderingTemplate2024).
 *
 * @private
 * @param {object} options - Options object.
 * @param {object} options.credential - The verifiable credential.
 * @returns {object|null} The NFC render method or null.
 */
function _findNfcRenderMethod({credential} = {}) {
  let renderMethods = credential?.renderMethod;
  if(!renderMethods) {
    return null;
  }

  // normalize to array for consistent handling
  if(!Array.isArray(renderMethods)) {
    renderMethods = [renderMethods];
  }

  // search for NFC-compatible render methods
  for(const method of renderMethods) {
    // check for TemplateRenderMethod with nfc output mode
    if(method.type === 'TemplateRenderMethod') {
      const modes = method.outputPreference?.mode;
      if(Array.isArray(modes) && modes.includes('nfc')) {
        // only return if template field exists (valid render method)
        if(method.template !== undefined) {
          return method;
        }
      }
    }

    // check for legacy format/existing codebase in
    // bedrock-web-wallet/lib/helper.js file
    if(method.type === 'NfcRenderingTemplate2024') {
      // only return if payload field exists (valid render method)
      if(method.payload !== undefined) {
        return method;
      }
    }
  }

  return null;
}

// ========================
// NFC rendering engine
// ========================

/**
 * Extract and validate template from render method.
 * Enforces strict field usage based on render method type.
 *
 * @private
 * @param {object} options - Options object.
 * @param {object} options.renderMethod - The render method object.
 * @returns {string} - Encoded template string.
 * @throws {Error} - If validation fails.
 */
function _extractTemplate({renderMethod} = {}) {
  let encoded;

  // check W3C spec format first
  if(renderMethod.type === 'TemplateRenderMethod') {
    encoded = renderMethod.template;
    if(!encoded) {
      throw new Error('TemplateRenderMethod requires "template" field.');
    }
  // check legacy format
  } else if(renderMethod.type === 'NfcRenderingTemplate2024') {
    encoded = renderMethod.payload;
    if(!encoded) {
      throw new Error('NfcRenderingTemplate2024 requires "payload" field.');
    }
  } else {
    throw new Error(`Unsupported render method type: ${renderMethod.type}`);
  }

  return encoded;
}

/**
 * Decode template to NFC payload bytes from template.
 * Extract, validates, and decodes the template field.
 *
 * @private
 * @param {object} options - Options object.
 * @param {object} options.renderMethod - The render method object.
 * @param {object} options.filteredData - Filtered credential data
 *  (may be null).
 * @returns {Promise<Uint8Array>} - NFC payload as bytes.
 */
// eslint-disable-next-line no-unused-vars
async function _decodeTemplateToBytes({renderMethod, filteredData} = {}) {
  // Note: filteredData is reserved for future template
  // processing with variables. Currently not used -
  // as templates contain complete binary payloads.

  // extract and validate template/payload field
  const encoded = _extractTemplate({renderMethod});

  // validate template is a string
  if(typeof encoded !== 'string') {
    throw new TypeError('Template or payload must be a string.');
  }

  // Rendering: Decode the template to bytes
  const bytes = await _decodeTemplate({encoded});

  return bytes;
}

async function _decodeTemplate({encoded} = {}) {
  // data URL format
  if(encoded.startsWith('data:')) {
    return _decodeDataUrl({dataUrl: encoded});
  }

  // multibase format (base58 'z' or base64url 'u')
  if(encoded[0] === 'z' || encoded[0] === 'u') {
    return _decodeMultibase({input: encoded});
  }

  throw new Error(
    'Unknown template encoding format. ' +
    'Supported formats: data URL (data:...) or multibase (z..., u...)'
  );
}

// ========================
// Decoding utilities
// ========================

/**
 * Decode a data URL to bytes.
 * Validates media type is application/octet-stream..
 *
 * @private
 * @param {object} options - Options object.
 * @param {string} options.dataUrl - Data URL string.
 * @returns {Uint8Array} Decoded bytes.
 * @throws {Error} If data URL is invalid or has wrong media type.
 */
function _decodeDataUrl({dataUrl} = {}) {
  // parse data URL format: data:mime/type;encoding,data
  const match = dataUrl.match(/^data:([^;]+);([^,]+),(.*)$/);
  if(!match) {
    throw new Error('Invalid data URL format.');
  }

  const mimeType = match[1];
  const encoding = match[2];
  const data = match[3];

  // validate media type is application/octet-stream
  if(mimeType !== 'application/octet-stream') {
    throw new Error(
      'Invalid data URL media type. ' +
      'NFC templates must use "application/octet-stream" media type. ' +
      `Found: "${mimeType}"`
    );
  }

  // decode based on encoding
  if(encoding === 'base64') {
    return base64ToBytes({base64String: data});
  }
  throw new Error(`Unsupported data URL encoding: ${encoding}`);
}

/**
 * Decode multibase-encoded string.
 *
 * @private
 * @param {object} options - Options object.
 * @param {string} options.input - Multibase encoded string.
 * @returns {Uint8Array} Decoded bytes.
 */
function _decodeMultibase({input} = {}) {
  const header = input[0];
  const encodedData = input.slice(1);

  const decoder = multibaseDecoders.get(header);
  if(!decoder) {
    throw new Error(`Unsupported multibase header: ${header}`);
  }

  return decoder.decode(encodedData);
}

// ============
// Exports
// ============

export default {
  supportsNfc,
  renderToNfc
};
