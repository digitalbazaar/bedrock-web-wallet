import {config} from '@bedrock/web';

const isDebugEnabled = () => {
  // Check config first
  if(config.wallet?.debug?.queryByExample) {
    return true;
  }

  // Node.js environment
  if(typeof process !== 'undefined' &&
      process.env?.DEBUG_QUERY_BY_EXAMPLE === 'true') {
    return true;
  }

  // Browser environment
  if(typeof window !== 'undefined' &&
      window.DEBUG_QUERY_BY_EXAMPLE === true) {
    return true;
  }

  return false;
};

export function debugLog(...args) {
  if(isDebugEnabled()) {
    console.log('[QBE DEBUG]', ...args);
  }
}
