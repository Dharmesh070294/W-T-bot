require("dotenv").config();

const trackedWallets = (process.env.TRACKED_WALLETS || "")
  .split(",")
  .map((w) => w.trim().toLowerCase())
  .filter(Boolean);

const WALLET_LABELS = {
  "0x025116fd668278b813ad46f84afefe45cb1cb441": "Dharmesh Wallet",
};

module.exports = {
  RPC_URL: process.env.RPC_URL,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  TRACKED_WALLETS: trackedWallets,
  MIN_ETH_ALERT: process.env.MIN_ETH_ALERT || "0",
  WALLET_LABELS,
};