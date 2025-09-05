/*!
 * Copyright (c) 2018-2025 Digital Bazaar, Inc. All rights reserved.
 */
import JsonPointer from 'json-pointer';

/**
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
export function matchCredentials(credentials, queryByExample) {
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
        console.log('Pointer error:', pointer, e.message);
        return false;
      }
    });
  });
}

/**
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
function _valuesMatch(actualValue, expectedValue) {
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
    return actualValue.some(item => _valuesMatch(item, expectedValue));
  }

  // If expected is array but actual is single value, check if actual
  // is in expected
  if(!Array.isArray(actualValue) && Array.isArray(expectedValue)) {
    return expectedValue.some(item => _valuesMatch(actualValue, item));
  }

  // For objects, do deep equality comparison
  if(typeof actualValue === 'object' && typeof expectedValue === 'object') {
    return _objectsMatch(actualValue, expectedValue);
  }

  // For primitive values, do strict equality with string normalization
  return _primitiveValuesMatch(actualValue, expectedValue);
}

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
    arr2.some(item2 => _valuesMatch(item1, item2))
  );
}

/**
 * Performs deep equality comparison for objects.
 *
 * @param {object} obj1 - First object.
 * @param {object} obj2 - Second object.
 *
 * @returns {boolean} True if objects are deeply equal.
 */
function _objectsMatch(obj1, obj2) {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  // Check if they have the same number of keys
  if(keys1.length !== keys2.length) {
    return false;
  }

  // Check if all keys and values match
  return keys1.every(key =>
    keys2.includes(key) && _valuesMatch(obj1[key], obj2[key])
  );
}

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
