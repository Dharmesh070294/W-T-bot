function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function validateEnv() {
  requireEnv("WALLET_RPC_URL");
  requireEnv("SWAP_RPC_URL");
  requireEnv("TELEGRAM_BOT_TOKEN");
  requireEnv("TELEGRAM_CHAT_ID");
  requireEnv("TRACKED_WALLETS");
}

module.exports = { validateEnv };