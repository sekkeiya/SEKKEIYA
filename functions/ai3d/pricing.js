const aiPricing = {
  imageTo3D: {
    triposr: 0,
    mock: 100,
    meshy: 100,
    tripo3d: 100
  }
};

const aiLimits = {
  free: {
    triposr: { daily: 3, monthly: 20 },
    tripo3d: { daily: Infinity, monthly: 3 },
    mock: { daily: Infinity, monthly: Infinity },
  },
  pro: {
    triposr: { daily: Infinity, monthly: 200 },
    tripo3d: { daily: Infinity, monthly: 30 },
    mock: { daily: Infinity, monthly: Infinity },
  },
  enterprise: {
    triposr: { daily: Infinity, monthly: Infinity },
    tripo3d: { daily: Infinity, monthly: 100 },
    mock: { daily: Infinity, monthly: Infinity },
  }
};

module.exports = { aiPricing, aiLimits };
