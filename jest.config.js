export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/api/tests'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
