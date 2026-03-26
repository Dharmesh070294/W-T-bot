require("dotenv").config();

const TRACKED_WALLETS = (process.env.TRACKED_WALLETS || "")
  .split(",")
  .map((w) => w.trim().toLowerCase())
  .filter(Boolean);

// 🔥 ALWAYS lowercase keys
const WALLET_LABELS = {
  "0x025116fd668278b813ad46f84afefe45cb1cb441": "Dharmesh Wallet",
  "0xa72031fe8fe22a1ff6dd88cb228cf06a74e4ca55": "Whale 1",
  "0x860e7106aaf1311b204eb9eb0b12271a2d964aa4": "Smart Trader 1",
};

// 🔥 Use REAL wallets here
const SMART_MONEY_WALLETS = [
  "0x860e7106aaf1311b204eb9eb0b12271a2d964aa4", // Smart Trader
];

module.exports = {
  RPC_URL: process.env.RPC_URL,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  TRACKED_WALLETS,
  WALLET_LABELS,
  SMART_MONEY_WALLETS,
};