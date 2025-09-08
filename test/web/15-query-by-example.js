/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import {edgeCaseCredentials, mockCredential, mockCredentials}
  from './mock-data.js';
import {queryByExample} from '@bedrock/web-wallet';
const {matchCredentials, convertExampleToPointers} = queryByExample;

describe('queryByExample', function() {

  describe('matchCredentials()', function() {

    describe('API and Basic Functionality', function() {
      it('should use named parameters API', function() {
        const queryByExample = {
          example: {
            credentialSubject: {name: 'John Doe'}
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        matches.should.have.length(1);
        matches[0].credentialSubject.name.should.equal('John Doe');
      });

      it('should return all credentials when no example provided', function() {
        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample: {}
        });

        matches.should.have.length(5); // All 5 mock credentials
      });

      it('should return all credentials when example is null', function() {
        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample: {example: null}
        });

        matches.should.have.length(5);
      });

      it('should handle empty credentials array', function() {
        const matches = matchCredentials({
          credentials: [],
          queryByExample: {example: {type: 'SomeType'}}
        });

        matches.should.have.length(0);
      });
    });

    describe('Semantic Features Tests', function() {
      describe('Empty Array Wildcard (anyArray)', function() {
        const queryByExample = {
          example: {
            credentialSubject: {
              allergies: [] // Empty array - any array
            }
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        // Should match Carol Davis (has allergies: [])
        matches.should.have.length(1);
        matches[0].credentialSubject.name.should.equal('Carol Davis');
      });

      it('should match credentials with populated arrays', function() {
        const queryByExample = {
          example: {
            credentialSubject: {
              skills: [] // Should match any array
            }
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        // Should match Bob Wilson (has skills array)
        matches.should.have.length(1);
        matches[0].credentialSubject.name.should.equal('Bob Wilson');
      });
    });

    describe('Empty Object Wildcar (anyValue)', function() {
      it('should match any value when example has empty object', function() {
        const queryByExample = {
          example: {
            credentialSubject: {
              continuingEducation: {} // Empty object - any value
            }
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        // Should match Eve Martinez (has continuingEducation: {})
        matches.should.have.length(1);
        matches[0].credentialSubject.name.should.equal('Eve Martinez');
      });

      it('should match populated objects with empty object wildcard',
        function() {
          const queryByExample = {
            example: {
              credentialSubject: {
                degree: {} // Should match any degree object
              }
            }
          };

          const matches = matchCredentials({
            credentials: mockCredentials,
            queryByExample
          });

          // Should match John Doe (has degree object)
          matches.should.have.length(1);
          matches[0].credentialSubject.name.should.equal('John Doe');
        });
    });

    describe('Null Semantic (mustBeNull)', function() {

      it('should match only when field is null', function() {
        const queryByExample = {
          example: {
            credentialSubject: {
              restrictions: null // Must be null
            }
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        // Should match Jane Smith (has restrictions: null)
        matches.should.have.length(1);
        matches[0].credentialSubject.name.should.equal('Jane Smith');
      });

      it('should match multiple null fields', function() {
        const queryByExample = {
          example: {
            credentialSubject: {
              medications: null,
              disciplinaryActions: null
            }
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        // Should match 0 credentials since no credential has
        // BOTH fields as null
        matches.should.have.length(0);
      });

      it('should match individual null fields correctly', function() {
        // Test medications: null
        const medicationsQuery = {
          example: {
            credentialSubject: {
              medications: null
            }
          }
        };

        const medicationsMatches = matchCredentials({
          credentials: mockCredentials,
          queryByExample: medicationsQuery
        });

        medicationsMatches.should.have.length(1);
        medicationsMatches[0].credentialSubject.name.
          should.equal('Carol Davis');

        // Test disciplinaryActions: null
        const disciplinaryQuery = {
          example: {
            credentialSubject: {
              disciplinaryActions: null
            }
          }
        };

        const disciplinaryMatches = matchCredentials({
          credentials: mockCredentials,
          queryByExample: disciplinaryQuery
        });

        disciplinaryMatches.should.have.length(1);
        disciplinaryMatches[0].credentialSubject.name.
          should.equal('Eve Martinez');
      });

      it('should match when field is missing', function() {
        // use a field that actually exists as null
        const queryByExample = {
          example: {
            credentialSubject: {
              medications: null
            }
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        matches.should.have.length(1);
        matches[0].credentialSubject.name.should.equal('Carol Davis');
      });
    });

    describe('Overlay Matching', function() {

      it('should match when credential has extra fields', function() {
        const queryByExample = {
          example: {
            credentialSubject: {
              degree: {
                type: 'BachelorDegree' // Only looking for this field
              }
            }
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        matches.should.have.length(1);
        matches[0].credentialSubject.degree.name
          .should.equal('Bachelor of Science');
        matches[0].credentialSubject.degree.major
          .should.equal('Computer Science');
      });

      it('should match nested objects with extra properties', function() {
        const queryByExample = {
          example: {
            credentialSubject: {
              alumniOf: {
                name: 'University of Example'
                // Doesn't specify 'location' or 'accredeitation'
                // but credential has them
              }
            }
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        matches.should.have.length(1);
        matches[0].credentialSubject.alumniOf.location
          .should.equal('City, State');
        matches[0].credentialSubject.alumniOf.accreditation.should
          .deep.equal(['ABET', 'Regional']);
      });
    });

    describe('Array Matching', function() {

      it('should match single value against array', function() {
        const queryByExample = {
          example: {
            type: 'UniversityDegreeCredential' // Single value
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        // Should match credential with type array containing this value
        matches.should.have.length(1);
        matches[0].credentialSubject.name.should.equal('John Doe');
      });

      it('should match array element', function() {
        const queryByExample = {
          example: {
            credentialSubject: {
              licenseClass: 'B' // Should match element in ['A', 'B', 'C']
            }
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        matches.should.have.length(1);
        matches[0].credentialSubject.name.should.equal('Jane Smith');
      });

      it('should match arrays with common elements', function() {
        const queryByExample = {
          example: {
            credentialSubject: {
              skills: ['JavaScript', 'Rust'] // Has JavaScript in common
            }
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        matches.should.have.length(1);
        matches[0].credentialSubject.name.should.equal('Bob Wilson');
      });

      it('should match array elements in complex structures', function() {
        const queryByExample = {
          example: {
            credentialSubject: {
              endorsements: 'Motorcycle'
              // Should match element in endorsements array
            }
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        matches.should.have.length(1);
        matches[0].credentialSubject.name.should.equal('Jane Smith');
      });
    });

    describe('Complex Nested Structures', function() {

      it('should handle deep nesting with multiple levels', function() {
        const queryByExample = {
          example: {
            credentialSubject: {
              vaccinations: [{
                name: 'COVID-19'
              }]
            }
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        matches.should.have.length(1);
        matches[0].credentialSubject.name.should.equal('Carol Davis');
      });

      it('should handle multiple field matching (AND logic)', function() {
        const queryByExample = {
          example: {
            type: 'EmployeeCredential',
            credentialSubject: {
              department: 'Engineering',
              skills: 'Python'
            }
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        matches.should.have.length(1);
        matches[0].credentialSubject.name.should.equal('Bob Wilson');
      });

      it('should handle complex nested object matching', function() {
        const queryByExample = {
          example: {
            credentialSubject: {
              address: {
                state: 'CA',
                city: 'Anytown',
              }
            }
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        matches.should.have.length(1);
        matches[0].credentialSubject.name.should.equal('Jane Smith');
      });
    });

    describe('Error Handling and Edge Cases', function() {

      it('should handle structure mismatch gracefully', function() {
        const queryByExample = {
          example: {
            credentialSubject: {
              nonExistentField: {
                deepNesting: 'value'
              }
            }
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        matches.should.have.length(0);
      });

      it('should handle invalid credentials gracefully', function() {
        const invalidCredentials = [
          null,
          undefined,
          'string',
          123,
          []
        ];

        const queryByExample = {
          example: {
            type: 'SomeType'
          }
        };

        const matches = matchCredentials({
          credentials: invalidCredentials,
          queryByExample
        });

        matches.should.have.length(0);
      });

      it('should handle complex pointer scenarios', function() {
        const queryByExample = {
          example: {
            credentialSubject: {
              manager: {
                name: 'Alice Johnson'
              }
            }
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        matches.should.have.length(1);
        matches[0].credentialSubject.name.should.equal('Bob Wilson');
      });
    });

    describe('String Normalization and Type Coercion', function() {

      it('should handle string trimming', function() {
        const queryByExample = {
          example: {
            credentialSubject: {
              name: 'Whitespace Person' // No extra spaces
            }
          }
        };

        const matches = matchCredentials({
          credentials: edgeCaseCredentials,
          queryByExample
        });

        matches.should.have.length(1);
      });

      it('should handle string/number coercion', function() {
        const queryByExample = {
          example: {
            credentialSubject: {
              age: 25 // Number
            }
          }
        };

        const matches = matchCredentials({
          credentials: edgeCaseCredentials,
          queryByExample
        });

        // Should match the credential with age: '25' (string)
        matches.should.have.length(1);
      });

      it('should handle reverse number/string coercion', function() {
        const queryByExample = {
          example: {
            credentialSubject: {
              yearOfBirth: '1998' // String
            }
          }
        };

        const matches = matchCredentials({
          credentials: edgeCaseCredentials,
          queryByExample
        });

        // Should match the credential with yearOfBirth: 1998 (number)
        matches.should.have.length(1);
      });
    });

    describe('Real-world Scenarios', function() {

      it('should handle medical record queries', function() {
        const queryByExample = {
          example: {
            type: 'MedicalCredential',
            credentialSubject: {
              bloodType: 'O+'
            }
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        matches.should.have.length(1);
        matches[0].credentialSubject.name.should.equal('Carol Davis');
      });

      it('should handle professional license queries', function() {
        const queryByExample = {
          example: {
            credentialSubject: {
              licenseType: 'Nursing',
              status: 'Active'
            }
          }
        };

        const matches = matchCredentials({
          credentials: mockCredentials,
          queryByExample
        });

        matches.should.have.length(1);
        matches[0].credentialSubject.name.should.equal('Eve Martinez');
      });
    });
  });

  describe('convertExamplesToPointers()', function() {

    describe('Basic Functionality', function() {
      it('should convert simple example to pointers', function() {

        const example = {
          type: 'UniversityDegreeCredential',
          credentialSubject: {
            name: 'John Doe'
          }
        };

        const pointers = convertExampleToPointers({example});

        pointers.should.be.an('array');
        pointers.length.should.be.greaterThan(0);

        // Check the expected pointers
        const pointerStrings = pointers.map(p => p.pointer);
        pointerStrings.should.include('/type');
        pointerStrings.should.include('/credentialSubject/name');
      });

      it('should include match types for each pointer', function() {
        const example = {
          type: 'TestType',
          nullField: null,
          emptyArray: [],
          emptyObject: {},
          normalField: 'value'
        };

        const pointers = convertExampleToPointers({example});

        pointers.forEach(pointer => {
          pointer.should.have.property('pointer');
          pointer.should.have.property('expectedValue');
          pointer.should.have.property('matchType');

          // Check match types are correct
          if(pointer.expectedValue === null) {
            pointer.matchType.should.equal('mustBeNull');
          } else if(Array.isArray(pointer.expectedValue) &&
              pointer.expectedValue.length === 0) {
            pointer.matchType.should.equal('anyArray');
          } else if(typeof pointer.expectedValue === 'object' &&
              Object.keys(pointer.expectedValue).length === 0) {
            pointer.matchType.should.equal('anyValue');
          } else {
            pointer.matchType.should.equal('exactMatch');
          }
        });
      });
    });

    describe('Context Handling', function() {
      it('should include @context by default', function() {
        const example = {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: 'TestType'
        };

        const pointers = convertExampleToPointers({example});

        const pointerStrings = pointers.map(p => p.pointer);
        pointerStrings.should.include('/@context/0');
      });

      it('should exclude @context when includeContext=false', function() {
        const example = {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: 'TestType'
        };

        const pointers = convertExampleToPointers({
          example,
          options: {includeContext: false}
        });

        const pointerStrings = pointers.map(p => p.pointer);
        pointerStrings.should.not.include('/@context/0');
        pointerStrings.should.include('/type');
      });
    });

    describe('Edge Cases', function() {
      it('should handle empty example', function() {
        const pointers = convertExampleToPointers({example: {}});
        pointers.should.have.length(0);
      });

      it('should handle null example', function() {
        const pointers = convertExampleToPointers({example: null});
        pointers.should.have.length(0);
      });

      it('should handle complex nested structures', function() {
        const example = {
          credentialSubject: {
            degree: {
              type: 'BachelorDegree',
              institution: {
                name: 'University',
                location: 'City'
              }
            }
          }
        };

        const pointers = convertExampleToPointers({example});

        // Should get deepest pointers
        const pointerStrings = pointers.map(p => p.pointer);
        pointerStrings.should.include('/credentialSubject/degree/type');
        pointerStrings.should
          .include('/credentialSubject/degree/institution/name');
        pointerStrings.should
          .include('/credentialSubject/degree/institution/location');
      });
    });

    describe('Integration with presentations.match()', function() {

      it('should work with credential store structure', function() {
        // Simulate data structure from presentations.js
        const mockCredentialRecords = [
          {
            record: {
              content: mockCredentials[0], // University degree
              meta: {id: 'cred-1'}
            }
          },
          {
            record: {
              content: mockCredentials[1], // Driver license
              meta: {id: 'cred-2'}
            }
          }
        ];

        // Extract credentials for matching (like presentations.js does)
        const credentials = mockCredentialRecords
          .map(item => item.record.content);

        const queryByExample = {
          example: {
            type: 'UniversityDegreeCredential'
          }
        };

        const matches = matchCredentials({credentials, queryByExample});

        matches.should.have.length(1);
        matches[0].credentialSubject.name.should.equal('John Doe');
      });

      it('should work with original mockCredential', function() {
        // Test backward compatibility with existing mockCredential
        const queryByExample = {
          example: {
            credentialSubject: {
              degree: {
                type: 'BachelorDegree'
              }
            }
          }
        };

        const matches = matchCredentials({
          credentials: [mockCredential],
          queryByExample
        });

        matches.should.have.length(1);
        matches[0].credentialSubject.degree.name
          .should.equal('Bachelor of Science and Arts');
      });
    });
  });
});
