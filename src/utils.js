const { ethers } = require("ethers");

function shortAddress(address) {
  if (!address) return "N/A";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatEth(value) {
  try {
    return ethers.formatEther(value);
  } catch {
    return "0";
  }
}

function isTracked(address, trackedWallets) {
  if (!address) return false;
  return trackedWallets.includes(address.toLowerCase());
}

module.exports = {
  shortAddress,
  formatEth,
  isTracked,
};