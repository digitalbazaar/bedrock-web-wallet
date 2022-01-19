/*!
 * Copyright (c) 2018-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {store as defaultStore} from 'bedrock-web-store';

export async function getProfileManager() {
  return defaultStore.get({id: 'profileManager'});
}

export async function getProfiles({type} = {}) {
  const profileManager = await getProfileManager();
  return profileManager.getProfiles({type});
}

export async function getProfileById({profileId}) {
  const profileManager = await getProfileManager();
  const profile = await profileManager.getProfile({id: profileId});
  return profile;
}

export async function getProfileName({profileId}) {
  const profileManager = await getProfileManager();
  const profile = await profileManager.getProfile({profileId});
  if(!profile) {
    return profileId;
  }
  return profile.name;
}
