/*!
 * Copyright (c) 2023-2025 Digital Bazaar, Inc. All rights reserved.
 */
export const mockCredential = {
  '@context': [
    'https://www.w3.org/2018/credentials/v1',
    {
      ex: 'https://example.org/examples#',
      schema: 'http://schema.org/',
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      BachelorDegree: 'ex:BachelorDegree',
      UniversityDegreeCredential: 'ex:UniversityDegreeCredential',
      degree: 'ex:degree',
      name: {
        '@id': 'schema:name',
        '@type': 'rdf:HTML'
      }
    },
    'https://w3id.org/security/suites/ed25519-2020/v1'
  ],
  id: 'http://example.gov/credentials/3732',
  type: [
    'VerifiableCredential',
    'UniversityDegreeCredential'
  ],
  issuer: 'did:key:z6MkmHipNuE35C6ona8Hkgpq3mpn4C3rX5kp1SjwcZ7HCWnH',
  issuanceDate: '2020-03-11T23:09:06.803Z',
  credentialSubject: {
    id: 'did:example:ebfeb1f712ebc6f1c276e12ec21',
    degree: {
      type: 'BachelorDegree',
      name: 'Bachelor of Science and Arts'
    }
  },
  proof: {
    type: 'Ed25519Signature2020',
    created: '2021-05-11T18:44:41Z',
    // eslint-disable-next-line max-len
    verificationMethod: 'did:key:z6MkmHipNuE35C6ona8Hkgpq3mpn4C3rX5kp1SjwcZ7HCWnH#z6MkmHipNuE35C6ona8Hkgpq3mpn4C3rX5kp1SjwcZ7HCWnH',
    proofPurpose: 'assertionMethod',
    // eslint-disable-next-line max-len
    proofValue: 'zqvrFELnqNYWBEsqkHPhqxXuQaNf3dpsQ3s6dLgkS1jAtAwXfwxf2TirW4kyPAUHNU3TXbS7JT38aF4jtnXGwiBT'
  }
};

// Enhanced test credentials for comprehensive Query By Example testing
export const mockCredentials = [
  // University Degree Credential - complex nested structure
  {
    '@context': [
      'https://www.w3.org/ns/credentials/v2'
    ],
    id: 'http://example.edu/credentials/degree-001',
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    credentialSubject: {
      id: 'did:example:123',
      name: 'John Doe',
      degree: {
        type: 'BachelorDegree',
        name: 'Bachelor of Science',
        major: 'Computer Science',
        gpa: 3.8
      },
      alumniOf: {
        name: 'University of Example',
        location: 'City, State',
        accreditation: ['ABET', 'Regional']
      },
      graduationDate: '2023-05-15T00:00:00Z'
    },
    issuer: {
      id: 'did:example:university',
      name: 'University of Example'
    },
    validFrom: '2023-01-01T00:00:00Z'
  },

  // Driver License - array fields and null values
  {
    '@context': [
      'https://www.w3.org/ns/credentials/v2'
    ],
    id: 'http://example.dmv/licenses/dl-456',
    type: ['VerifiableCredential', 'DriverLicense'],
    credentialSubject: {
      id: 'did:example:456',
      name: 'Jane Smith',
      licenseNumber: 'DL123456789',
      licenseClass: ['A', 'B', 'C'], // Array for testing
      restrictions: null, // Null for testing null semantics
      endorsements: ['Motorcycle', 'Commercial'],
      address: {
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        postalCode: '90210'
      }
    },
    issuer: {
      id: 'did:example:dmv',
      name: 'Department of Motor Vehicles'
    },
    validFrom: '2022-06-01T00:00:00Z',
    validUntil: '2027-06-01T00:00:00Z'
  },

  // Employee Credential - skills array and department info
  {
    '@context': [
      'https://www.w3.org/ns/credentials/v2'
    ],
    id: 'http://example.company/employees/emp-789',
    type: ['VerifiableCredential', 'EmployeeCredential'],
    credentialSubject: {
      id: 'did:example:789',
      name: 'Bob Wilson',
      employeeId: 'EMP-789',
      department: 'Engineering',
      position: 'Senior Developer',
      skills: ['JavaScript', 'Python', 'Go', 'Docker'], // Array for testing
      clearanceLevel: 'Secret',
      startDate: '2020-03-01T00:00:00Z',
      manager: {
        name: 'Alice Johnson',
        id: 'did:example:manager-001'
      }
    },
    issuer: {
      id: 'did:example:company',
      name: 'Example Corporation'
    },
    validFrom: '2020-03-01T00:00:00Z'
  },

  // Medical Credential - testing various data types
  {
    '@context': [
      'https://www.w3.org/ns/credentials/v2'
    ],
    id: 'http://example.hospital/records/med-321',
    type: ['VerifiableCredential', 'MedicalCredential'],
    credentialSubject: {
      id: 'did:example:321',
      name: 'Carol Davis',
      bloodType: 'O+',
      allergies: [], // Empty array for wildcard testing
      medications: null, // Null for testing
      vaccinations: [
        {
          name: 'COVID-19',
          date: '2023-01-15T00:00:00Z',
          lot: 'ABC123'
        },
        {
          name: 'Influenza',
          date: '2022-10-01T00:00:00Z',
          lot: 'FLU456'
        }
      ],
      emergencyContact: {
        name: 'David Davis',
        relationship: 'Spouse',
        phone: '555-0123'
      }
    },
    issuer: {
      id: 'did:example:hospital',
      name: 'Example Hospital'
    },
    validFrom: '2023-02-01T00:00:00Z'
  },

  // Professional License - minimal structure for edge case testing
  {
    '@context': [
      'https://www.w3.org/ns/credentials/v2'
    ],
    id: 'http://example.board/licenses/prof-555',
    type: ['VerifiableCredential', 'ProfessionalLicense'],
    credentialSubject: {
      id: 'did:example:555',
      name: 'Eve Martinez',
      licenseType: 'Nursing',
      licenseNumber: 'RN987654',
      status: 'Active',
      specializations: ['ICU', 'Emergency'], // Array
      disciplinaryActions: null, // Null testing
      continuingEducation: {} // Empty object for wildcard testing
    },
    issuer: {
      id: 'did:example:nursing-board',
      name: 'State Nursing Board'
    },
    validFrom: '2021-01-01T00:00:00Z'
  }
];

// Test credentials for specific edge cases
export const edgeCaseCredentials = [
  // Credential with missing fields (for null testing)
  {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    type: ['VerifiableCredential'],
    credentialSubject: {
      id: 'did:example:minimal',
      name: 'Minimal Person'
      // Intentionally missing many fields
    },
    issuer: {
      id: 'did:example:issuer'
    }
  },

  // Credential with string numbers (for type coercion testing)
  {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    type: ['VerifiableCredential', 'AgeCredential'],
    credentialSubject: {
      id: 'did:example:age-test',
      name: 'Age Test Person',
      age: '25', // String number
      yearOfBirth: 1998 // Actual number
    },
    issuer: {
      id: 'did:example:issuer'
    }
  },

  // Credential with whitespace issues (for string normalization testing)
  {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    type: ['VerifiableCredential'],
    credentialSubject: {
      id: 'did:example:whitespace',
      name: '  Whitespace Person  ', // Extra spaces
      title: '\tSenior Engineer\n' // Tabs and newlines
    },
    issuer: {
      id: 'did:example:issuer'
    }
  }
];
