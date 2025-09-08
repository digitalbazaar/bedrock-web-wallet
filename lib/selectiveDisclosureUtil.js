/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import {klona} from 'klona';

// Adapted from @digitalbazaar/di-sd-primitives/lib/pointer.js.
// JSON pointer escape sequences
// ~0 => '~'
// ~1 => '/'
const POINTER_ESCAPE_REGEX = /~[01]/g;

/**
 * Selects JSON-LD using JSON pointers to create a selection document.
 * Adapted from @digitalbazaar/di-sd-primitives/lib/select.js.
 *
 * @param {object} options - The options.
 * @param {object} options.document - The JSON-LD document to select from.
 * @param {Array<string>} options.pointers - Array of JSON pointer strings.
 * @param {boolean} [options.includeTypes=true] - Whether to include type
 *    information.
 *
 * @returns {object|null} The selection document or null if no selection
 *    possible.
 */
export function selectJsonLd({document, pointers, includeTypes = true} = {}) {
  if(!(document && typeof document === 'object')) {
    throw new TypeError('"document" must be an object.');
  }
  if(!Array.isArray(pointers)) {
    throw new TypeError('"pointers" must be an array.');
  }
  if(pointers.length === 0) {
    // no pointers, so no frame
    return null;
  }

  // track arrays to make them dense after selection
  const arrays = [];
  // perform selection
  const selectionDocument = {'@context': klona(document['@context'])};
  _initSelection(
    {selection: selectionDocument, source: document, includeTypes});
  for(const pointer of pointers) {
    // parse pointer into individual paths
    const paths = parsePointer(pointer);
    if(paths.length === 0) {
      // whole document selected
      return klona(document);
    }
    _selectPaths({
      document, pointer, paths, selectionDocument, arrays, includeTypes
    });
  }

  // make any sparse arrays dense
  for(const array of arrays) {
    let i = 0;
    while(i < array.length) {
      if(array[i] === undefined) {
        array.splice(i, 1);
        continue;
      }
      i++;
    }
  }

  return selectionDocument;
}

/**
 * Parses a JSON pointer string into an array of paths.
 * Adapted from @digitalbazaar/di-sd-primitives/lib/pointer.js.
 *
 * @param {string} pointer - JSON pointer string (e.g., '/foo/bar/0').
 *
 * @returns {Array} Array of path components (strings and numbers for
 *    array indices).
 */
export function parsePointer(pointer) {
  // see RFC 6901: https://www.rfc-editor.org/rfc/rfc6901.html
  const parsed = [];
  const paths = pointer.split('/').slice(1);
  for(const path of paths) {
    if(!path.includes('~')) {
      // convert any numerical path to a number as an array index
      const index = parseInt(path, 10);
      parsed.push(isNaN(index) ? path : index);
    } else {
      parsed.push(path.replace(POINTER_ESCAPE_REGEX, _unescapePointerPath));
    }
  }
  return parsed;
}

/**
 * Adjusts pointers to ensure proper credential structure and
 * gets deepest pointers.
 * Adapted from presentations.js (_adjustPointers) for reusability.
 * TODO: use this function in presentations.js.
 *
 * @param {Array<string>} pointers - Array of JSON pointer strings.
 *
 * @returns {Array<string>} Array of adjusted pointer strings.
 */
export function adjustPointers(pointers) {
  // ensure `credentialSubject` is included in any reveal, presume that if
  // it isn't present that the entire credential subject was requested
  const hasCredentialSubject = pointers.some(
    pointer => pointers.includes('/credentialSubject/') ||
      pointer.endsWith('/credentialSubject'));
  if(!hasCredentialSubject) {
    pointers = pointers.slice();
    pointers.push('/credentialSubject');
  }

  pointers = pruneShallowPointers(pointers);

  // make `type` pointers generic
  return pointers.map(pointer => {
    const index = pointer.indexOf('/type/');
    return index === -1 ? pointer : pointer.slice(0, index) + '/type';
  });
}

/**
 * Gets only the deepest pointers from the given list of pointers.
 * For example, `['/a/b', '/a/b/c', '/a/b/c/d']` will be
 * pruned to: `['/a/b/c/d']`.
 * Adapted from presentations.js (_pruneShallowPointers) for reusability.
 * TODO: use this function in presentations.js.
 *
 * @param {Array<string>} pointers - Array of JSON pointer strings.
 *
 * @returns {Array<string>} Array of deepest pointer strings.
 */
export function pruneShallowPointers(pointers) {
  const deep = [];
  for(const pointer of pointers) {
    let isDeep = true;
    for(const p of pointers) {
      if(pointer.length < p.length && p.startsWith(pointer)) {
        isDeep = false;
        break;
      }
    }
    if(isDeep) {
      deep.push(pointer);
    }
  }
  return deep;
}

// =============================================================================
// INTERNAL HELPER FUNCTIONS
// =============================================================================

/**
 * Helper for selectJsonLd - selects paths in the document.
 * Adapted from @digitalbazaar/di-sd-primitives/lib/select.js.
 *
 * @param {object} root0 - The options object.
 * @param {object} root0.document - The source JSON-LD document.
 * @param {string} root0.pointer - The JSON pointer string.
 * @param {Array<string|number>} root0.paths - The parsed pointer paths.
 * @param {object} root0.selectionDocument - The selection document being built.
 * @param {Array} root0.arrays - Array tracker for dense arrays.
 * @param {boolean} root0.includeTypes - Whether to include type information.
 */
function _selectPaths({
  document, pointer, paths, selectionDocument, arrays, includeTypes} = {}) {
  // make pointer path in selection document
  let parentValue = document;
  let value = parentValue;
  let selectedParent = selectionDocument;
  let selectedValue = selectedParent;

  for(const path of paths) {
    selectedParent = selectedValue;
    parentValue = value;
    // get next document value
    value = parentValue[path];
    if(value === undefined) {
      throw new TypeError(
        `JSON pointer "${pointer}" does not match document.`);
    }
    // get next value selection
    selectedValue = selectedParent[path];
    if(selectedValue === undefined) {
      if(Array.isArray(value)) {
        selectedValue = [];
        arrays.push(selectedValue);
      } else {
        selectedValue = _initSelection({source: value, includeTypes});
      }
      selectedParent[path] = selectedValue;
    }
  }

  // path traversal complete, compute selected value
  if(typeof value !== 'object') {
    // literal selected
    selectedValue = value;
  } else if(Array.isArray(value)) {
    // full array selected
    selectedValue = klona(value);
  } else {
    // object selected, blend with `id` / `type` / `@context`
    selectedValue = {...selectedValue, ...klona(value)};
  }

  // add selected value to selected parent
  selectedParent[paths.at(-1)] = selectedValue;
}

/**
 * Helper for selectJsonLd - initializes selection with id/type.
 * Adapted from @digitalbazaar/di-sd-primitives/lib/select.js.
 *
 * @param {object} root0 - The options object.
 * @param {object} [root0.selection={}] - The selection object to initialize.
 * @param {object} root0.source - The source object to select from.
 * @param {boolean} root0.includeTypes - Whether to include type information.
 * @returns {object} The initialized selection object.
 */
function _initSelection({selection = {}, source, includeTypes}) {
  // must include non-blank node IDs
  if(source.id && !source.id.startsWith('_:')) {
    selection.id = source.id;
  }
  // include types if directed to do so
  if(includeTypes && source.type) {
    selection.type = source.type;
  }
  return selection;
}

/**
 * Unescapes JSON pointer path components.
 * Adapted from @digitalbazaar/di-sd-primitives/lib/pointer.js.
 *
 * @param {string} m - The escape sequence to unescape.
 * @returns {string} The unescaped path component.
 */
function _unescapePointerPath(m) {
  if(m === '~1') {
    return '/';
  }
  if(m === '~0') {
    return '~';
  }
  throw new Error(`Invalid JSON pointer escape sequence "${m}".`);
}
