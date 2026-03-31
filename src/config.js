require("dotenv").config();

const TRACKED_WALLETS = process.env.TRACKED_WALLETS
  ? process.env.TRACKED_WALLETS.split(",").map((w) => w.trim().toLowerCase())
  : [];

const SMART_MONEY_WALLETS = process.env.SMART_MONEY_WALLETS
  ? process.env.SMART_MONEY_WALLETS.split(",").map((w) => w.trim().toLowerCase())
  : [];

module.exports = {
  WALLET_RPC_URL: process.env.WALLET_RPC_URL,
  SWAP_RPC_URL: process.env.SWAP_RPC_URL,

  TRACKED_WALLETS,

  WALLET_LABELS: {
    "0x025116fd668278b813ad46f84afefe45cb1cb441": "Dharmesh Wallet",
    "0xa72031fe8fe22a1ff6dd88cb228cf06a74e4ca55": "Whale 1",
    "0x860e7106aaf1311b204eb9eb0b12271a2d964aa4": "Smart Trader 1",
  },

  SMART_MONEY_WALLETS,
};