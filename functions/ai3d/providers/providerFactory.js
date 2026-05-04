const { runMockProvider, checkMockProvider } = require("./mockProvider");
const { runMeshyProvider, checkMeshyProvider } = require("./meshyProvider");
const { runTripoProvider, checkTripoProvider } = require("./tripoProvider");
const { runTriposrProvider, checkTriposrProvider } = require("./triposrProvider");

const providerFactory = {
  startJob: async (jobId, uid, data) => {
    const provider = data.provider || "mock";
    switch (provider) {
      case "mock":
        return runMockProvider(jobId, uid, data);
      case "meshy":
        return runMeshyProvider(jobId, uid, data);
      case "tripo3d":
        return runTripoProvider(jobId, uid, data);
      case "triposr":
        return runTriposrProvider(jobId, uid, data);
      default:
        throw new Error(`Unsupported provider for startJob: ${provider}`);
    }
  },
  
  checkJob: async (jobId, uid, jobData) => {
    const provider = jobData.provider || "mock";
    switch (provider) {
      case "mock":
        return checkMockProvider(jobId, uid, jobData);
      case "meshy":
        return checkMeshyProvider(jobId, uid, jobData);
      case "tripo3d":
        return checkTripoProvider(jobId, uid, jobData);
      case "triposr":
        return checkTriposrProvider(jobId, uid, jobData);
      default:
        throw new Error(`Unsupported provider for checkJob: ${provider}`);
    }
  }
};

module.exports = { providerFactory };
