/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import {queryByExample} from '@bedrock/web-wallet';
const {matchCredentials} = queryByExample;

describe('queryByExample', function() {
  describe('matchCredentials()', function() {
    const mockCredentials = [
      {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'UniversityDegreeCredential'],
        credentialSubject: {
          id: 'did:example:123',
          name: 'John Doe',
          degree: {
            type: 'BachelorDegree',
            name: 'Bachelor of Science'
          },
          alumniOf: {
            name: 'University of Example'
          }
        }
      },
      {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'DriverLicense'],
        credentialSubject: {
          id: 'did:example:456',
          name: 'Jane Smith',
          licenseClass: 'A'
        }
      }
    ];

    it('should match credentials by single field', async function() {
      const query = {
        example: {
          credentialSubject: {
            name: 'John Doe'
          }
        }
      };

      const matches = matchCredentials(mockCredentials, query);
      matches.should.have.length(1);
      matches[0].credentialSubject.name.should.equal('John Doe');
    });

    it('should match credentials by nested object fields', async function() {
      const query = {
        example: {
          credentialSubject: {
            degree: {
              type: 'BachelorDegree'
            }
          }
        }
      };

      const matches = matchCredentials(mockCredentials, query);
      matches.should.have.length(1);
      matches[0].credentialSubject.degree.type.should.equal('BachelorDegree');
    });

    it('should match credentials by array type field', async function() {
      const query = {
        example: {
          type: 'UniversityDegreeCredential'
        }
      };

      const matches = matchCredentials(mockCredentials, query);
      matches.should.have.length(1);
      matches[0].type.should.include('UniversityDegreeCredential');
    });

    it('should return empty array when no matches found', async function() {
      const query = {
        example: {
          credentialSubject: {
            degree: {
              type: 'MastersDegree' // doesn't exist in test data
            }
          }
        }
      };

      const matches = matchCredentials(mockCredentials, query);
      matches.should.have.length(0);
    });

    it('should return all credentials when no example provided',
      async function() {
        const query = {};
        const matches = matchCredentials(mockCredentials, query);
        matches.should.have.length(2);
      });

    it('should match multiple fields (AND logic)', async function() {
      const query = {
        example: {
          type: 'UniversityDegreeCredential',
          credentialSubject: {
            degree: {
              name: 'Bachelor of Science'
            }
          }
        }
      };

      const matches = matchCredentials(mockCredentials, query);
      matches.should.have.length(1);
      matches[0].credentialSubject.name.should.equal('John Doe');
      // Also verify the fields queried for are present
      matches[0].type.should.include('UniversityDegreeCredential');
      matches[0].credentialSubject.degree.name
        .should.equal('Bachelor of Science');
    });
  });
});
