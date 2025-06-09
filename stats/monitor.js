
// stats/monitor.js
let callCount = 0;
let costEstimate = 0;

function recordApiCall(costPerCall) {
  callCount++;
  costEstimate += costPerCall;
}

function getStats() {
  return {
    callCount,
    costEstimate: `$${costEstimate.toFixed(2)}`,
    timestamp: new Date().toISOString()
  };
}

module.exports = { recordApiCall, getStats };
