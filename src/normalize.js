const { normalizeAddress } = require("./normalize");
function normalizeAddress(address) {
  if (!address || typeof address !== "string") return "";
  return address.trim().toLowerCase();
}

module.exports = { normalizeAddress };