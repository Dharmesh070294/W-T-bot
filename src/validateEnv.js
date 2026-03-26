function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function validateEnv() {
  const required = [
    "RPC_URL",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
    "TRACKED_WALLETS",
  ];

  for (const key of required) {
    requireEnv(key);
  }

  const wallets = process.env.TRACKED_WALLETS.split(",")
    .map((w) => w.trim())
    .filter(Boolean);

  for (const wallet of wallets) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      throw new Error(`Invalid wallet address in TRACKED_WALLETS: ${wallet}`);
    }
  }

  if (!/^\d+$/.test(process.env.TELEGRAM_CHAT_ID.trim())) {
    throw new Error("TELEGRAM_CHAT_ID must be numeric");
  }
}

module.exports = { validateEnv };