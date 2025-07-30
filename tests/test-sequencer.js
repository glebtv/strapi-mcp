const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Sort tests so that unit tests run first, then integration tests
    const unitTests = [];
    const integrationTests = [];
    
    tests.forEach(test => {
      if (test.path.includes('/tools/')) {
        unitTests.push(test);
      } else {
        integrationTests.push(test);
      }
    });
    
    // Sort each group alphabetically for consistency
    unitTests.sort((a, b) => a.path.localeCompare(b.path));
    integrationTests.sort((a, b) => a.path.localeCompare(b.path));
    
    return [...unitTests, ...integrationTests];
  }
}

module.exports = CustomSequencer;