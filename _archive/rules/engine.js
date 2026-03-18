
// rules/engine.js
const fs = require('fs');
const path = require('path');

const rulesPath = path.join(__dirname, 'rules.json');

function loadRules() {
  if (!fs.existsSync(rulesPath)) return [];
  const data = fs.readFileSync(rulesPath);
  return JSON.parse(data);
}

function evaluate(input) {
  const rules = loadRules();
  for (const rule of rules) {
    if (input.includes(rule.trigger)) {
      return rule.action;
    }
  }
  return null;
}

module.exports = { evaluate };
