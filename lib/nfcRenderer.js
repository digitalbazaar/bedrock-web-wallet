/**
 * VC NFC Renderer Library
 * Handles NFC rendering for verifiable credentials.
 * Supports both static and dynamic rendering modes.
 */
import * as base58 from 'base58-universal';
import * as base64url from 'base64url-universal';

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
export function supportsNFC({credential} = {}) {
  try {
    const renderMethod = _findNFCRenderMethod({credential});
    if(renderMethod !== null) {
      return true;
    }
    // no NFC render method found
    return false;
  } catch(error) {
    return false;
  }
}

/**
 * Render a verifiable credential to NFC payload bytes.
 *
 * Supports both static (pre-encoded) and dynamic (runtime extraction)
 * rendering modes based on the renderSuite value:
 *  - "nfc-static": Uses template/payload field.
 *  - "nfc-dynamic": Extracts data using renderProperty.
 *  - "nfc": Generic fallback - static takes priority if both exist.
 *
 * @param {object} options - Options object.
 * @param {object} options.credential - The verifiable credential.
 * @returns {Promise<object>} Object with bytes property: {bytes: Uint8Array}.
 */
export async function renderToNfc({credential} = {}) {
  // find NFC-compatible render method
  const renderMethod = _findNFCRenderMethod({credential});

  if(!renderMethod) {
    throw new Error(
      'The verifiable credential does not support NFC rendering.'
    );
  }

  // determining rendering mode and route to appropriate handler
  const suite = _getRenderSuite({renderMethod});

  if(!suite) {
    throw new Error('Unable to determine render suite for NFC rendering.');
  }

  let bytes;

  switch(suite) {
    case 'nfc-static':
      bytes = await _renderStatic({renderMethod});
      break;
    case 'nfc-dynamic':
      bytes = await _renderDynamic({renderMethod, credential});
      break;
    case 'nfc':
      // try static first, fall back to dynamic if renderProperty exists

      // BEHAVIOR: Static rendering has priority over dynamic rendering.
      // If BOTH template/payload AND renderProperty exist, static is used
      // and renderProperty is ignored (edge case).
      if(_hasStaticPayload({renderMethod})) {
        bytes = await _renderStatic({renderMethod});
      } else if(renderMethod.renderProperty) {
        // renderProperty exists, proceed with dynamic rendering
        bytes = await _renderDynamic({renderMethod, credential});
      } else {
        throw new Error(
          'NFC render method has neither payload nor renderProperty.'
        );
      }
      break;
    default:
      throw new Error(`Unsupported renderSuite: ${suite}`);
  }

  // wrap in object for consistent return format
  return {bytes};
}

// ========================
// Render method detection
// ========================

/**
 * Find the NFC-compatible render method in a verifiable credential.
 *
 * @private
 * @param {object} options - Options object.
 * @param {object} options.credential - The verifiable credential.
 * @returns {object|null} The NFC render method or null.
 */
function _findNFCRenderMethod({credential} = {}) {
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
    // check for W3C spec format with nfc renderSuite
    if(method.type === 'TemplateRenderMethod') {
      const suite = method.renderSuite?.toLowerCase();
      if(suite && suite.startsWith('nfc')) {
        return method;
      }
    }

    // check for legacy format/existing codebase in
    // bedrock-web-wallet/lib/helper.js file
    if(method.type === 'NfcRenderingTemplate2024') {
      return method;
    }
  }

  return null;
}

/**
 * Get the render suite with fallback for legacy formats.
 *
 * @private
 * @param {object} options - Options object.
 * @param {object} options.renderMethod - The render method object.
 * @returns {string} The render suite identifier.
 */
function _getRenderSuite({renderMethod} = {}) {
  // use renderSuite if present
  if(renderMethod.renderSuite) {
    return renderMethod.renderSuite.toLowerCase();
  }

  // legacy format defaults to static
  if(renderMethod.type === 'NfcRenderingTemplate2024') {
    return 'nfc-static';
  }

  // generic fallback
  return 'nfc';
}

/**
 * Check if render method has a static payload.
 *
 * @private
 * @param {object} options - Options object.
 * @param {object} options.renderMethod - The render method object.
 * @returns {boolean} - 'true' if has template or payload field.
 */
function _hasStaticPayload({renderMethod} = {}) {
  if(renderMethod.template || renderMethod.payload) {
    return true;
  }
  return false;
}

// ========================
// Static rendering
// ========================

/**
 * Render static NFC payload.
 *
 * @param {object} options - Options object.
 * @param {object} options.renderMethod - The render method object.
 * @returns {Promise<Uint8Array>} - NFC payload as bytes.
 */
async function _renderStatic({renderMethod} = {}) {

  // get the payload from template or payload field
  const encoded = renderMethod.template || renderMethod.payload;

  if(!encoded) {
    throw new Error(
      'Static NFC render method has no template or payload field.'
    );
  }

  if(typeof encoded !== 'string') {
    throw new Error('Template or payload must be a string.');
  }

  // decoded based on format
  if(encoded.startsWith('data:')) {
    // data URI format
    return _decodeDataUri({dataUri: encoded});
  }
  if(encoded[0] === 'z' || encoded[0] === 'u') {
    // multibase format
    return _decodeMultibase({input: encoded});
  }
  throw new Error('Unknown payload encoding format');
}

// ========================
// Dynamic rendering
// ========================

/**
 * Render dynamic NFC payload by extracting data from a verifiable
 * credential.
 *
 * @param {object} options - Options object.
 * @param {object} options.renderMethod - The render method object.
 * @param {object} options.credential - The verifiable credential.
 * @returns {Promise<Uint8Array>} - NFC payload as bytes.
 */
async function _renderDynamic(
  {renderMethod, credential} = {}) {

  // validate renderProperty exists
  if(!renderMethod.renderProperty) {
    throw new Error('Dynamic NFC rendering requires renderProperty.');
  }

  // normalize to array for consistent handling
  const propertyPaths = Array.isArray(renderMethod.renderProperty) ?
    renderMethod.renderProperty : [renderMethod.renderProperty];

  if(propertyPaths.length === 0) {
    throw new Error('renderProperty cannot be empty.');
  }

  // extract values from a verifiable credential using JSON pointers
  const extractedValues = [];

  for(const path of propertyPaths) {
    const value = _resolveJSONPointer({obj: credential, pointer: path});

    if(value === undefined) {
      throw new Error(`Property not found in credential: ${path}`);
    }

    extractedValues.push({path, value});
  }

  // build the NFC payload from extracted values
  return _buildDynamicPayload(
    {extractedValues});
}

/**
 * Build NFC payload from extracted credential values.
 *
 * @private
 * @param {object} options - Options object.
 * @param {Array} options.extractedValues - Extracted values with paths.
 * @returns {Uint8Array} - NFC payload as bytes.
 */
function _buildDynamicPayload({extractedValues} = {}) {

  // simple concatenation of UTF-8 encoded values
  const chunks = [];

  for(const item of extractedValues) {
    const valueBytes = _encodeValue({value: item.value});
    chunks.push(valueBytes);
  }

  // concatenate all chunks into single payload
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;
  for(const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Encode a value to bytes.
 *
 * @private
 * @param {object} options - Options object.
 * @param {*} options.value - The value to encode.
 * @returns {Uint8Array} The encoded bytes.
 */
function _encodeValue({value} = {}) {
  if(typeof value === 'string') {
    // UTF-8 encode strings
    return new TextEncoder().encode(value);
  }
  if(typeof value === 'number') {
    // convert number to string then encode
    return new TextEncoder().encode(String(value));
  }
  if(typeof value === 'object') {
    // JSON stringify objects
    return new TextEncoder().encode(JSON.stringify(value));
  }
  // fallback: convert to string
  return new TextEncoder().encode(String(value));
}

// ========================
// Decoding utilities
// ========================

/**
 * Decode a data URI to bytes.
 *
 * @private
 * @param {object} options - Options object.
 * @param {string} options.dataUri - Data URI string.
 * @returns {Uint8Array} Decoded bytes.
 */
function _decodeDataUri({dataUri} = {}) {
  // parse data URI format: data:mime/type;encoding,data
  const match = dataUri.match(/^data:([^;]+);([^,]+),(.*)$/);

  if(!match) {
    throw new Error('Invalid data URI format.');
  }

  // const mimeType = match[1];
  const encoding = match[2];
  const data = match[3];

  // decode based on encoding
  if(encoding === 'base64') {
    return _base64ToBytes({base64String: data});
  }
  if(encoding === 'base64url') {
    return base64url.decode(data);
  }
  throw new Error(`Unsupported data URI encoding: ${encoding}`);
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

/**
 * Decode standard base64 to bytes.
 *
 * @private
 * @param {object} options - Options object.
 * @param {string} options.base64String - Base64 encoded string.
 * @returns {Uint8Array} Decoded bytes.
 */
function _base64ToBytes({base64String} = {}) {
  // use atob in browser, Buffer in Node
  if(typeof atob !== 'undefined') {
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for(let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Node.js environment
  return Buffer.from(base64String, 'base64');
}

// ========================
// JSON pointer utilities
// ========================

/**
 * Resolve a JSON pointer in an object per RFC 6901.
 *
 * @private
 * @param {object} options - Options object.
 * @param {object} options.obj - The object to traverse.
 * @param {string} options.pointer - JSON pointer string.
 * @returns {*} The value at the pointer location or undefined.
 */
function _resolveJSONPointer({obj, pointer} = {}) {
  // handle empty pointer (refers to entire document)
  if(pointer === '' || pointer === '/') {
    return obj;
  }

  // remove leading slash
  let path = pointer;
  if(path.startsWith('/')) {
    path = path.slice(1);
  }

  // split into segments
  const segments = path.split('/');

  // traverse the object
  let current = obj;

  for(const segment of segments) {
    // decode special characters per RFC 6901: ~1 = /, ~0 = ~
    const decoded = segment
      .replace(/~1/g, '/')
      .replace(/~0/g, '~');

    // handle array indices
    if(Array.isArray(current)) {
      const index = parseInt(decoded, 10);
      if(isNaN(index) || index < 0 || index >= current.length) {
        return undefined;
      }
      current = current[index];
    } else if(typeof current === 'object' && current !== null) {
      current = current[decoded];
    } else {
      return undefined;
    }

    // return early if undefined
    if(current === undefined) {
      return undefined;
    }
  }

  return current;
}

// ============
// Exports
// ============

export default {
  supportsNFC,
  renderToNfc
};
