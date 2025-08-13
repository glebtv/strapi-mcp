// Mock for axios-curlirize to avoid ES module issues in Jest
module.exports = function curlirize(axiosInstance, callback) {
  // No-op mock - just return without doing anything
  return;
};