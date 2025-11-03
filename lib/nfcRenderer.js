/*!
 * VC NFC Renderer Library
 * Handles NFC rendering for Verifiable Credentials
 * Supports both static and dynamic rendering modes
 * TODO: Eventually, create a reusable and
 * indpendent library with NFC functionality.
 */

// ==================================================
// PUBLIC API
// ==================================================

/**
 * Check if a credential supports NFC rendering.
 *
 * @param {object} credential - The verifiable credential.
 * @returns {boolean} True if NFC is supported.
 */
export function supportsNFC(credential) {
  return true | false;
}

/**
 * Get NFC rendering information from a credential.
 *
 * @param {object} credential - The verifiable credential.
 * @returns {object} {suite, hasPayload, isDynamic, renderMethod}.
 */
export function getNFCInfo(credential) {
  return {};
}

/**
 * Render a credential to NFC payload bytes.
 *
 * @param {object} credential - The verifiable credential.
 * @param {object} options - Rendering options.
 * @returns {Promise<Uint8Array>} - NFC payload as bytes.
 */
export async function renderToNFC(credential, options = {}) {
  // step 1: Find the NFC render method
  _findNFCRenderMethod(credential);
  // step 2: Determine rendering mode based on suite
  const suite = _getRenderSuite(renderMethod);

  // step 3: Route to appropriate renderer
  switch(suite) {
    case 'nfc-static':
      return _renderStatic(renderMethod, credential, options);
    case 'nfc-dynamic':
      return _renderDynamic(renderMethod, credential, options);
    case 'nfc':
      // TODO: Try static first, fall back to dynamic if renderProperty exists.
    default:
      throw new Error(`Unsupported renderSuite: ${suite}`);
  }
}

// ==================================================
// Render Method Detection
// ==================================================

/**
 * Find the NFC-compatible render method in a credential.
 *
 * @private
 */

function _findNFCRenderMethod(credential) {
  // Look for method.type = 'TemplateRenderMethod' or for legacy support
  // 'NfcRenderingTemplate2024'
}

/**
 * Get the render suite, with fallback for legacy formats.
 *
 * @private
 */

function _getRenderSuite(renderMethod) {
  // legacy format - default to static
  if(renderMethod.type === 'NfcRenderingTemplate2024') {
    return 'nfc-static';
  }

  // generic fallback -- Question - do we need generic fallback??
  return 'nfc';
}

/**
 * Check if render method has a static payload.
 *
 * @private
 */

function _hasStaticPayload(renderMethod) {

  // An example with pre-encoded NFC payload stored directly in the credential.

  // {
  //   "renderMethod": {
  //     "type": "TemplateRenderMethod",
  //     "renderSuite": "nfc-static",
  //     "template": "data:application/octet-stream;base64,SGVsbG8="
  //   }
  // }

}

// ==================================================
// Static Rendering
// ==================================================

/**
 * Render static NFC payload.
 * The payload is already encoded in the render method.
 *
 * @private
 */

async function _renderStatic(renderMethod, credential, options) {
  // Extract the payload/template field.
  // Detect the encoding format.
  // Decode to bytes.
  // Return bytes.
  return;
}

// ==================================================
// Dynamic Rendering
// ==================================================

/**
 * Render dynamic NFC payload by extracting data from credential.
 *
 * @private
 */

async function _renderDynamic(renderMethod, credential, options) {
  // An example - extract values from credential at runtime using JSON
  // Pointers based on renderProperty mappings.

  //{
  //  "credentialSubject": {
  //    "studentId": "STU123456",
  //    "barcode": "987654321"
  //    },
  //  "renderMethod": {
  //    "type": "TemplateRenderMethod",
  //    "renderSuite": "nfc-dynamic",
  //    "renderProperty": [
  //      "/credentialSubject/studentId",
  //      "/credentialSubject/barcode"
  //    ]
  //  }
  //}

  // Questions: Does order matter in renderProperty array?
  // Should we support named properties instead?

  // "renderProperty": {
  //   "fn": "/credentialSubject/firstName",
  //   "ln": "/credentialSubject/lastName"
  // }

  // Should we enforce NFC size limits? If yes, where??

  // Validate configuration - renderProperty exists.
  // Normalize renderProperty to array.
  // Extract values from credential using JSON pointers.
  // Encode values to bytes or other formats if needed.
  // Decode values to bytes if needed.
  // Build the NFC payload from the extracted values.
  return _buildDynamicPayload(extractedValues, renderMethod, options);
}

/**
 * Build NFC payload from extracted credential values.
 *
 * @private
 */

function _buildDynamicPayload(extractedValues, renderMethod, options) {
  // TODO: Support different payload formats (CBOR-LD, JSON-LD, custom)
  // Custom - simple concatenation of UTF-8 encoded strings.

  // Question: What should be the payload formats supports available by default?
  // CBOR/JSON Encoding
  return;
}

// ==================================================
// Encoding/Decoding utility functions goes here
// ==================================================

// ==================================================
// JSON Pointer utility functions goes here
// ==================================================
