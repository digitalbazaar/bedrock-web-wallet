/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import {adjustPointers, selectJsonLd}
  from './selectiveDisclosureUtil.js';
import {debugLog} from './debug.js';
import JsonPointer from 'json-pointer';

/**
 * Matches credentials against a Query By Example specification.
 * This function processes the full QueryByExample matching on a list of VCs
 * that have already been preliminarily filtered (e.g., by top-level type).
 *
 * @param {object} options - The options.
 * @param {Array} options.credentials - Array of credential objects to
 *    match against.
 * @param {object} options.queryByExample - The Query By Example specification.
 * @param {object} options.queryByExample.example - The example credential
 *    structure to match against.
 *
 * @returns {Array} Array of credentials that match the Query By Example
 *  specification.
 */
export function matchCredentials({credentials, queryByExample} = {}) {
  const {example} = queryByExample || {};
  if(!(example && typeof example === 'object')) {
    // no example to match against, return all credentials
    return credentials || [];
  }

  // Input validation - filter out invalid credentials
  if(!Array.isArray(credentials)) {
    debugLog('Credentials is not an array:', credentials); // DEBUG
    return [];
  }

  debugLog('Input credentials count:', credentials.length); // DEBUG
  debugLog('Input credentials:', credentials.map(c => ({ // DEBUG
    type: c?.type,
    name: c?.credentialSubject?.name,
    hasCredentialSubject: !!c?.credentialSubject
  })));

  // Filter out invalid individual credentials
  const validCredentials = credentials.filter(credential => {
    const isValid = credential &&
           typeof credential === 'object' &&
           !Array.isArray(credential) &&
           credential.credentialSubject &&
           typeof credential.credentialSubject === 'object';

    if(!isValid) {
      debugLog('Filtered out invalid credential:', credential); // DEBUG
    }
    return isValid;
  });

  debugLog('Valid credentials count:', validCredentials.length); // DEBUG

  debugLog('Example:', example); // DEBUG

  // Convert example to deepest pointers with expected values
  const pointerValuePairs = convertExampleToPointers({example});

  debugLog('Pointer value pairs:', pointerValuePairs); // DEBUG

  if(pointerValuePairs.length === 0) {
    return validCredentials;
  }

  return validCredentials.filter(credential => {
    debugLog('About to test credential:',
      credential.credentialSubject?.name); // DEBUG

    const match = _credentialMatches({credential, pointerValuePairs});

    debugLog('Credential match result:', match,
      'for:', credential.credentialSubject?.name); // DEBUG
    return match;
  });
}

/**
 * NOT IN USE - Version 0 - use matchCredentials instead.
 *
 * Matches credentials against a Query By Example specification.
 * This function processes the full QueryByExample matching on a list of VCs
 * that have already been preliminarily filtered (e.g., by top-level type).
 *
 * @param {Array} credentials - Array of credential objects to match against.
 * @param {object} queryByExample - The Query By Example specification.
 * @param {object} queryByExample.example - The example credential structure
 *    to match against.
 *
 * @returns {Array} Array of credentials that match the Query By Example
 *  specification.
 */
export function matchCredentials_v0(credentials, queryByExample) {
  const {example} = queryByExample;
  if(!(example && typeof example === 'object')) {
    // no example to match against, return all credentials
    return credentials;
  }

  // Convert example to JSON pointers, excluding @context as it's handled
  // separately
  const expectedPointers = _convertExampleToPointers(example);

  if(expectedPointers.length === 0) {
    // no meaningful fields to match, return all credentials
    return credentials;
  }

  return credentials.filter(credential => {
    // Check each pointer against the credential content
    return expectedPointers.every(({pointer, expectedValue}) => {
      try {
        const actualValue = JsonPointer.get(credential, pointer);
        const result = _valuesMatch(actualValue, expectedValue);

        return result;
      } catch(e) {
        // If pointer doesn't exist in credential, it's not a match
        debugLog('Pointer error:', pointer, e.message);
        return false;
      }
    });
  });
}

/**
 * Converts a Query By Example to JSON pointers with expected values.
 * This function can be used by presentation.js and other modules for
 * selective disclosure and pointer-based operations.
 *
 * @param {object} options - The options.
 * @param {object} options.example - The example object from Query By Example.
 * @param {object} [options.options={}] - Conversion options.
 * @param {boolean} [options.options.includeContext=true] - Whether to include
 *   context field matching.
 *
 * @returns {Array<object>} Array of objects with
 *  {pointer, expectedValue, matchType}
 *  where pointer is a JSON pointer string, expectedValues is the
 *  expected value, and matchType describes how to match
 *  ('exactMatch', 'anyArray', etc.).
 */
export function convertExampleToPointers({example, options = {}} = {}) {
  if(!(example && typeof example === 'object')) {
    return [];
  }

  const {includeContext = true} = options;
  const pointerValuePairs = [];

  // Prepare example for processing
  const processedExample = {...example};

  // Handle @context based on options
  if(!includeContext) {
    delete processedExample['@context'];
  }

  debugLog('Processed example:', processedExample); // DEBUG

  try {
    // Convert to JSON pointer dictionary (reuse existing approach)
    const dict = JsonPointer.dict(processedExample);
    debugLog('JSON pointer dict:', dict); // DEBUG

    // Process arrays to convert indexed pointers to array-level pointers
    const processedDict = _processArraysInDict(dict);
    debugLog('Processed dict with array handling:', processedDict);

    // WORKAROUND: JsonPointer.dict() filters out empty arrays/objects
    // We need to manually find them since they're wildcards in our system
    const additionalPointers = _findEmptyValuesPointers(processedExample);
    debugLog('Additional pointers for empty values:',
      additionalPointers); // DEBUG

    // Extract pointer/value pairs with match types
    const allPointers = new Set(); // Prevent duplicates

    for(const [pointer, value] of Object.entries(processedDict)) {
      if(!allPointers.has(pointer)) { // Check for duplicates
        const matchType = _determineMatchType(value);

        debugLog('Pointer:', pointer, 'Value:',
          value, 'MatchType:', matchType); // DEBUG

        // Include all pointer/value pairs (even 'ignore' type for completeness)
        pointerValuePairs.push({
          pointer,
          expectedValue: value,
          matchType
        });
        allPointers.add(pointer);
      }
    }

    // Add the empty arrays/objects that JsonPointer.dict() missed
    for(const {pointer, value} of additionalPointers) {
      if(!allPointers.has(pointer)) { // Check for duplicates
        const matchType = _determineMatchType(value);

        debugLog('Additional Pointer:', pointer, 'Value:',
          value, 'MatchType:', matchType); // DEBUG

        pointerValuePairs.push({
          pointer,
          expectedValue: value,
          matchType
        });

        allPointers.add(pointer);
      }

    }
  } catch(e) {
    // If JSON pointer conversion fails, return empty array
    console.warn('Failed to convert example to JSON pointers:', e);
    return [];
  }

  debugLog('Before adjustPointers:', pointerValuePairs); // DEBUG

  // Apply pointer adjustments (use deepest pointers, handle credentialSubject)
  // This ensures compatibility with selective disclosure approach
  const rawPointers = pointerValuePairs.map(pair => pair.pointer);
  const deepestPointers = adjustPointers(rawPointers);

  debugLog('Raw pointers:', rawPointers); // DEBUG
  debugLog('Deepest pointers:', deepestPointers); // DEBUG

  // Filter to only include adjusted (deepest) pointers
  const finalPairs = pointerValuePairs.filter(pair =>
    deepestPointers.includes(pair.pointer)
  );

  debugLog('Final pairs:', finalPairs); // DEBUG

  return finalPairs;
}

function _findEmptyValuesPointers(obj, basePath = '') {
  const pointers = [];

  for(const [key, value] of Object.entries(obj)) {
    const currentPath = basePath + '/' + key;

    if(Array.isArray(value) && value.length === 0) {
      // Empty array - add it
      pointers.push({pointer: currentPath, value});
    } else if(typeof value === 'object' && value !== null &&
              Object.keys(value).length === 0) {
      // Empty object - add it
      pointers.push({pointer: currentPath, value});
    } else if(value === null) {
      // Null value - add it
      pointers.push({pointer: currentPath, value});
    } else if(typeof value === 'object' && value !== null) {
      // Recurse into nested objects
      pointers.push(..._findEmptyValuesPointers(value, currentPath));
    }
  }

  return pointers;
}

// Convert array element pointers to array-level pointers
function _processArraysInDict(dict) {
  const processed = {};
  const arrayGroups = {};

  // Group array element pointers
  for(const [pointer, value] of Object.entries(dict)) {
    const arrayMatch = pointer.match(/^(.+)\/(\d+)$/);
    if(arrayMatch) {
      const [, arrayPath, index] = arrayMatch;

      // Skip @context arrays - keep them as individual elements
      if(arrayPath === '/@context') {
        processed[pointer] = value; // Keep original pointer like /@context/0
        continue;
      }

      // Process other arrays normally
      if(!arrayGroups[arrayPath]) {
        arrayGroups[arrayPath] = [];
      }
      arrayGroups[arrayPath][parseInt(index)] = value;
    } else {
      processed[pointer] = value;
    }
  }

  // Convert array groups to array-level pointers (excluding @context)
  for(const [arrayPath, elements] of Object.entries(arrayGroups)) {
    const denseArray = elements.filter(el => el !== undefined);
    processed[arrayPath] = denseArray;
  }

  return processed;
}

/**
 * NOT IN USE - Version 0 - use convertExampleToPointers instead.
 *
 * Converts an example to an array of JSON pointer/value pairs.
 * This function recursively processes the example object to extract all
 * field paths and their expected values, excluding @context which is
 * handled separately in the filtering pipeline.
 *
 * @param {object} example - The example object from Query By Example.
 *
 * @returns {Array<object>} Array of objects with {pointer, expectedValue}
 *  where pointer is a JSON pointer string (e.g., '/credentialSubject/name')
 *  and expectedValue is the expected value at the path.
 */
function _convertExampleToPointers(example) {
  const pointers = [];

  // Create a copy without @context since it's handled by _matchContextFilter
  const exampleWithoutContext = {...example};
  delete exampleWithoutContext['@context'];

  // Convert to JSON pointer dictionary and extract pointer/value pairs
  try {
    const dict = JsonPointer.dict(exampleWithoutContext);
    for(const [pointer, value] of Object.entries(dict)) {
      // Skip empty objects, arrays, or null/undefined values
      if(_isMatchableValue(value)) {
        pointers.push({
          pointer,
          expectedValue: value
        });
      }
    }
  } catch(e) {
    // If JSON pointer conversion fails, return empty array
    console.warn('Failed to convert example to JSON pointers:', e);
    return [];
  }
  return pointers;
}

/**
 * Determines if a value is suitable for matching. We skip empty objects,
 * empty arrays, null, undefined, and other non-meaningful values.
 *
 * @param {*} value - The value to check.
 *
 * @returns {boolean} True if the value should be used for matching.
 */
function _isMatchableValue(value) {
  // Skip null, undefined
  if(value == null) {
    return false;
  }

  // Skip empty arrays
  if(Array.isArray(value) && value.length === 0) {
    return false;
  }

  // Skip empty objects
  if(typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).length === 0) {
    return false;
  }

  // All other values (strings, numbers, booleans, non-empty arrays/objects)
  return true;
}

/**
 * NOT IN USE - Version 0 - use _valuesMatch instead.
 *
 * Determines if an actual value from a credential matches an expected value
 * from a Query By Example specification. This handles various matching
 * scenarios including arrays, different types, and normalization.
 *
 * @param {*} actualValue - The value found in the credential.
 * @param {*} expectedValue - The expected value from the example.
 *
 * @returns {boolean} True if the values match according to Query By Example
 *  matching rules.
 */
/*
function _valuesMatch_v0(actualValue, expectedValue) {
  // Handle null/undefined cases
  if(actualValue == null && expectedValue == null) {
    return true;
  }
  if(actualValue == null || expectedValue == null) {
    return false;
  }

  // If both are arrays, check if they have common elements
  if(Array.isArray(actualValue) && Array.isArray(expectedValue)) {
    return _arraysHaveCommonElements(actualValue, expectedValue);
  }

  // If actual is array but expected is single value, check if array
  // contains the value
  if(Array.isArray(actualValue) && !Array.isArray(expectedValue)) {
    return actualValue.some(item => _valuesMatch_v0(item, expectedValue));
  }

  // If expected is array but actual is single value, check if actual
  // is in expected
  if(!Array.isArray(actualValue) && Array.isArray(expectedValue)) {
    return expectedValue.some(item => _valuesMatch_v0(actualValue, item));
  }

  // For objects, do deep equality comparison
  if(typeof actualValue === 'object' && typeof expectedValue === 'object') {
    return _objectsMatch(actualValue, expectedValue);
  }

  // For primitive values, do strict equality with string normalization
  return _primitiveValuesMatch(actualValue, expectedValue);
}
*/

/**
 * Checks if two arrays have any common elements.
 *
 * @param {Array} arr1 - First array.
 * @param {Array} arr2 - Second array.
 *
 * @returns {boolean} True if arrays have at least one common element.
 */
function _arraysHaveCommonElements(arr1, arr2) {
  return arr1.some(item1 =>
    arr2.some(item2 => _valuesMatchExact(item1, item2))
  );
}

/**
 * NOT IN USE - Version 0 - use _objectsMatchOverlay instead.
 *
 * Performs deep equality comparison for objects.
 *
 * @param {object} obj1 - First object.
 * @param {object} obj2 - Second object.
 *
 * @returns {boolean} True if objects are deeply equal.
 */
/*
function _objectsMatch(obj1, obj2) {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  // Check if they have the same number of keys
  if(keys1.length !== keys2.length) {
    return false;
  }

  // Check if all keys and values match
  return keys1.every(key =>
    keys2.includes(key) && _valuesMatch_v0(obj1[key], obj2[key])
  );
}
*/

/**
 * Compares primitive values (string, numbers, booleans) with appropriate
 * normalization and type coercion.
 *
 * @param {*} actual - Actual primitive value.
 * @param {*} expected - Expected primitive value.
 *
 * @returns {boolean} True if primitive value match.
 */
function _primitiveValuesMatch(actual, expected) {
  // Strict equality first (handles numbers, booleans, exact strings)
  if(actual === expected) {
    return true;
  }

  // String comparison with normalization
  if(typeof actual === 'string' && typeof expected === 'string') {
    // Trim whitespace and compare case-sensitively
    return actual.trim() === expected.trim();
  }

  // Type coercion for string/number comparisons
  if((typeof actual === 'string' && typeof expected === 'number') ||
     (typeof actual === 'number' && typeof expected === 'string')) {
    return String(actual) === String(expected);
  }

  // No match
  return false;
}

// =============================================================================
// TODO: IMPLEMENT CORE MATCHING FUNCTIONS
// =============================================================================

/**
 * Tests if a credential matches using selective disclosure approach.
 *
 * @param {object} root0 - The options object.
 * @param {object} root0.credential - The credential to test.
 * @param {Array<object>} root0.pointerValuePairs - Array of pointer/value
 *    pairs to match from convertExampleToPointers().
 *
 * @returns {boolean} True if the credential matches, false otherwise.
 */
function _credentialMatches({credential, pointerValuePairs}) {

  debugLog('Testing credential:',
    credential.credentialSubject?.name); // DEBUG

  debugLog('Pointers to test:', pointerValuePairs.map(p => ({
    pointer: p.pointer,
    expectedValue: p.expectedValue,
    matchType: p.matchType
  }))); // DEBUG

  // Separate null checking from structural checking
  const nullPairs = pointerValuePairs.filter(pair =>
    pair.matchType === 'mustBeNull');

  // Filter out 'ignore' type pointers since they don't affect structure
  const structuralPairs = pointerValuePairs.filter(pair =>
    pair.matchType != 'ignore' && pair.matchType !== 'mustBeNull'
  );

  // Handle mustBeNull pairs directly without selectJsonLd
  for(const pair of nullPairs) {
    const {pointer} = pair;
    debugLog('Checking null field:', pointer); // DEBUG
    try {
      const actualValue = _getValueByPointer(credential, pointer);
      debugLog('Actual value for', pointer, ':', actualValue); // DEBUG

      // For mustBeNull: actualValue must be EXPLICITLY null (not undefined)
      if(actualValue !== null) {
        debugLog('Field is not explicitly null, no match'); // DEBUG
        return false;
      }
    } catch(error) {
      // If pointer doesn't exist (undefined), it
      // doesn't match explicit null
      debugLog('Pointer not found (undefined), does not' +
        'match explicit null'); // DEBUG
    }
  }

  // Only use selectJsonLd for non-null structural validation
  if(structuralPairs.length === 0) {
    // No structural requirements, so any credential matches
    return true;
  }

  try {
    // Extract just the pointers for structure testing
    const pointers = pointerValuePairs.map(pair => pair.pointer);
    debugLog('Calling selectJsonLd with pointers:', pointers); // DEBUG

    // Use selectJsonLd to test if the credential has the required structure
    const selection = selectJsonLd({
      document: credential,
      pointers,
      includeTypes: true
    });

    debugLog('selectJsonLd result:', selection); // DEBUG

    if(!selection) {
      // Structure doesn't match - selectJsonLd returned null
      debugLog('selectJsonLd returned null - no structural match'); // DEBUG
      return false;
    }

    // Structure matches, now validate the selected values
    const result = _validateSelectedValues({selection, pointerValuePairs});
    debugLog('_validateSelectedValues result:', result); // DEBUG
    return result;

  } catch(e) {
    // Pointer structure doesn't match document (TypeError from selectJsonLd)
    debugLog('selectJsonLd threw error:', e.message); // DEBUG
    return false;
  }
}

/**
 * Validates selected values against expected values with match types.
 * Called after structural matching succeeds.
 *
 * @param {object} root0 - The options object.
 * @param {object} root0.selection - The selected values from the credential.
 * @param {Array<object>} root0.pointerValuePairs - Array of pointer/value
 *   pairs to match from convertExampleToPointers().
 *
 * @returns {boolean} True if all selected values match the expected values,
 *   false otherwise.
 */
function _validateSelectedValues({selection, pointerValuePairs}) {
  debugLog('_validateSelectedValues called with:'); // DEBUG
  debugLog('Selection:', selection); // DEBUG
  debugLog('PointerValuePairs:', pointerValuePairs); // DEBUG

  // Check each pointer-value pair against the selection
  return pointerValuePairs.every(({pointer, expectedValue, matchType}) => {
    try {
      // Extract the actual value from the selection using the pointer
      const actualValue = _getValueByPointer(selection, pointer);

      debugLog('Validating pointer:', pointer); // DEBUG
      debugLog('Expected value:', expectedValue, 'type:',
        typeof expectedValue); // DEBUG
      debugLog('Actual value:', actualValue,
        'type:', typeof actualValue); // DEBUG

      // Use enhanced value matching with match type
      const result = _valuesMatch(actualValue, expectedValue, matchType);
      debugLog('_valuesMatch result:', result); // DEBUG
      return result;

    } catch(error) {
      // If can't get the value, it doesn't match
      debugLog('Error in _validateSelectedValues:', error.message); // DEBUG
      return false;
    }
  });
}

/**
 * Gets a value from an object using a JSON pointer string.
 * Simple implementation for extracting values from selection.
 *
 * @param {object} obj - The object to extract the value from.
 * @param {string} pointer - The JSON pointer string
 *    (e.g., "/credentialSubject/name").
 * @returns {*} The value found at the pointer location, or
 *    undefined if not found.
 */
function _getValueByPointer(obj, pointer) {
  if(pointer === '') {
    return obj;
  }

  const paths = pointer.split('/').slice(1); // Remove empty first element
  let current = obj;

  for(const path of paths) {
    if(current == null) {
      return undefined;
    }

    // Handle array indices
    const index = parseInt(path, 10);
    const key = isNaN(index) ? path : index;

    current = current[key];
  }
  return current;
}

/**
 * Determines the match type for a value based on new semantic rules.
 * This implements the enhanced semantics from Feedback 4-6.
 *
 * @param {*} value - The value from the Query By Example to analyze.
 *
 * @returns {string} The match type:
 *   - 'ignore': undefined values (property wasn't specified).
 *   - 'mustBeNull': null values (credential field must be null/missing).
 *   - 'anyArray': empty arrays (credential must have any array).
 *   - 'anyValue': empty objects (credential can have any value).
 *   - 'exactMatch': all other values (credential must match this value).
 */
function _determineMatchType(value) {
  // undefined means "ignore this field" - property wasn't specified in example
  if(value === undefined) {
    return 'ignore';
  }

  // null means "credential field must be null or missing"
  if(value === null) {
    return 'mustBeNull';
  }

  // Empty array means "credential must have any array" (wildcard)
  if(Array.isArray(value) && value.length === 0) {
    return 'anyArray';
  }

  // Empty object means "credential can have any value" (wildcard)
  if(typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).length === 0) {
    return 'anyValue';
  }

  // All other values require exact matching
  return 'exactMatch';
}

/**
 * Enhanced value matching with match type support.
 * Implements new semantic rules and overlay matching approach.
 *
 * @param {*} actual - The actual value from the credential.
 * @param {*} expected - The expected value from the example.
 * @param {string} [matchType='exactMatch'] - The match type to use.
 *
 * @returns {boolean} True if the values match according to the match type.
 */
function _valuesMatch(actual, expected, matchType = 'exactMatch') {
  switch(matchType) {
    case 'ignore':
      // Always match - this field should be ignored
      return true;
    case 'mustBeNull':
      // Credential field must be null or missing
      return actual == null;
    case 'anyArray':
      // Credential must have any array
      return Array.isArray(actual);
    case 'anyValue':
      // Credential can have any value (wildcard)
      return true;
    case 'exactMatch':
      // Use enhanced comparison logic with overlay matching
      return _valuesMatchExact(actual, expected);
    default:
      console.warn(`Unknown match type: ${matchType}`);
      return false;
  }
}

/**
 * Enhanced exact value matching with overlay approach.
 * Implements the "overlay" concept.
 *
 * @param {*} actual - The actual value from the credential.
 * @param {*} expected - The expected value from the example.
 *
 * @returns {boolean} True if values match using overlay rules.
 */
function _valuesMatchExact(actual, expected) {
  debugLog('_valuesMatchExact called:', {actual, expected}); // DEBUG
  // Handle null/undefined cases
  if(actual == null && expected == null) {
    return true;
  }

  if(actual == null || expected == null) {
    return false;
  }

  // If both are arrays, check if they have common elements
  if(Array.isArray(actual) && Array.isArray(expected)) {
    return _arraysHaveCommonElements(actual, expected);
  }

  // If actual is array but expected is single value, check if array
  // contains the value
  if(Array.isArray(actual) && !Array.isArray(expected)) {
    debugLog('Array vs single value - checking containment'); // DEBUG
    const result = actual.some(item => _valuesMatchExact(item, expected));
    debugLog('Containment result:', result); // DEBUG
    return result;
  }

  // If expected is array but actual is single value, check if actual
  // is in expected
  if(!Array.isArray(actual) && Array.isArray(expected)) {
    return expected.some(item => _valuesMatchExact(actual, item));
  }

  // For objects, do overlay matching (not exact equality)
  if(typeof actual === 'object' && typeof expected === 'object') {
    return _objectsMatchOverlay(actual, expected);
  }

  // For primitive values, do strict equality with string normalization
  return _primitiveValuesMatch(actual, expected);
}

/**
 * Overlay object matching - checks if expected fields exist in actual object.
 * The actual object can have additional fields (overlay approach).
 *
 * @param {object} actual - Actual object from credential.
 * @param {object} expected - Expected object from example.
 *
 * @returns {boolean} True if all expected fields match actual fields.
 */
function _objectsMatchOverlay(actual, expected) {
  const expectedKeys = Object.keys(expected);

  // Check if all expected keys and values exist and match in actual object
  return expectedKeys.every(key => {
    // Expected key must exist in actual object
    if(!(key in actual)) {
      return false;
    }

    // Recursively check the values match using overlay approach
    return _valuesMatchExact(actual[key], expected[key]);
  });
}
