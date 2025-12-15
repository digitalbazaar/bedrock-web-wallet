/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import {profileManager} from '../state.js';

// Hardcoded reference ID
// Reason: NOT added in config to avoid auto-creation for all accounts.
const ETHEREUM_EDV_REFERENCE_ID = 'ethereum-edv';

/**
 * Gets the Ethereum EDV for a profile.
 * Creates the EDV if it doesn't exist (only when triggered from UI).
 *
 * @param {object} options - The options to use.
 * @param {string} options.profileId - The ID of the profile.
 *
 * @returns {Promise<{profileId: string, edvClient: object}>} - Returns
 * profileId and edvClient.
 */
export async function getEthereumEdv({profileId} = {}) {
  if(!profileId) {
    throw new TypeError('"profileId" is required.');
  }

  let edvClient;

  try {
    // Try to get existing EDV
    ({edvClient} = await profileManager.getProfileEdvAccess({
      profileId,
      referenceIdPrefix: ETHEREUM_EDV_REFERENCE_ID
    }));
  } catch(e) {
    console.log('EDV access error:', e.message);
    // EDV doesn't exist, create it
    const meters = await profileManager.getProfileMeters({profileId});
    console.log('Available meters:', JSON.stringify(meters, null, 2));

    // Log all referenceIds to see what's available
    console.log('All referenceIds:',
      meters?.map(m => m.referenceId || m.meter?.referenceId));

    const edvMeter = meters.find(m => m.referenceId === 'profile:core:edv');
    console.log('EDV meter found:', JSON.stringify(edvMeter, null, 2));

    if(!edvMeter) {
      throw new Error('No EDV meter found for profile.');
    }

    console.log('Using meterId:', edvMeter.id);

    ({edvClient} = await profileManager.createProfileEdv({
      profileId,
      meterId: edvMeter.id,
      referenceId: ETHEREUM_EDV_REFERENCE_ID
    }));
  }

  // Ensure indexes for efficient queries
  edvClient.ensureIndex({attribute: 'content.type', unique: false});
  edvClient.ensureIndex({attribute: 'content.address', unique: false});

  console.log(`profileId: ${profileId}`);
  // console.log(`edvClient: ${JSON.stringify(edvClient)}`);

  return {profileId, edvClient};
}
