/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from '@bedrock/web';
import {delegate} from './zcap.js';
import {profileManager} from './state.js';
import {v4 as uuid} from 'uuid';

export async function addUser({accessManager, options}) {
  if(!accessManager) {
    // TODO: Implement more rigorous validator
    throw new Error('"accessManager" must be defined.');
  }
  if(!options) {
    // TODO: Implement more rigorous validator
    throw new Error('"options" must be defined.');
  }

  const {email, name, access} = options;

  const content = {
    type: ['User', 'Person'],
    email,
    name,
    access: access.toLowerCase(),
    authorizedDate: (new Date()).toISOString()
  };

  let user = await accessManager.createUser({content});
  const {profile} = accessManager;
  user.onboardLink = createOnboardLink({user, profile});

  if(access.toLowerCase() === 'full') {
    // TODO: this should only be delegating the profile's zcap key zcap and
    // all other zcaps should be generated on demand

    // get admin agent and delegate the same zcaps
    const profileId = profile.id;
    const adminAgent = await profileManager.getAgent({profileId});
    const {invocationSigner} = await profileManager.getProfileSigner(
      {profileId});

    // create new delegated capabilities for all the targets that the
    // parent profile has access to
    const promises = Object.values(adminAgent.zcaps)
      .map(async templateZcap => {
        // FIXME: Implement API in profile manager to delegate zcaps
        const zcap = {...templateZcap};
        delete zcap.invoker;
        delete zcap.delegator;
        delete zcap.proof;
        // FIXME: import code to generate properly encoded id
        zcap.id = `urn:uuid:${uuid()}`;
        zcap.controller = user.id;
        return delegate({zcap, signer: invocationSigner});
      });

    // TODO: Find proper promise-fun library for concurrency
    const delegations = await Promise.all(promises);
    for(const delegation of delegations) {
      user.zcaps[delegation.referenceId] = delegation;
    }
  }

  user = await accessManager.updateUser({user});
  return user;
}

export async function updateUser({accessManager, oldUser, updatedUser}) {
  const oldAccess = oldUser.access.toLowerCase();
  const updatedAccess = updatedUser.access.toLowerCase();
  if(oldAccess !== updatedAccess) {
    // FIXME: Re-enable when implementation is needed
    if(updatedAccess === 'full') {
      // FIXME: Give full access
    } else {
      // FIXME: Remove all access
    }
  }
  const content = {
    ...oldUser,
    ...updatedUser
  };
  const user = await accessManager.updateUser({user: content});
  return user;
}

export async function removeUser({accessManager, user}) {
  try {
    await accessManager.removeUser({id: user.id});
    return true;
  } catch(e) {
    if(e.name !== 'NotFoundError') {
      throw e;
    }
  }
}

export function createOnboardLink({user, profile}) {
  let onboardLink = config.wallet.defaults.onboardLink;
  const {id, email} = user;
  const params = new URLSearchParams({
    profileName: profile.name,
    profileAgent: id,
    email
  });
  return onboardLink += `?${params}`;
}

export default {addUser, updateUser, removeUser, createOnboardLink};
