const { ethers } = require("ethers");
const { RPC_URL, TRACKED_WALLETS, WALLET_LABELS } = require("./config");
const { sendTelegramMessage } = require("./telegram");

const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

// Add tokens you want to track (Sepolia examples or mainnet later)
const TOKEN_CONTRACTS = [
  // Example:
  // "0xYourTokenAddress"
];

async function startErc20Tracker() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  for (const tokenAddress of TOKEN_CONTRACTS) {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    let symbol = "TOKEN";
    let decimals = 18;

    try {
      symbol = await contract.symbol();
      decimals = await contract.decimals();
    } catch {}

    contract.on("Transfer", async (from, to, value, event) => {
      const fromLower = from.toLowerCase();
      const toLower = to.toLowerCase();

      const fromTracked = TRACKED_WALLETS.includes(fromLower);
      const toTracked = TRACKED_WALLETS.includes(toLower);

      if (!fromTracked && !toTracked) return;

      const wallet = fromTracked ? fromLower : toLower;
      const label = WALLET_LABELS[wallet] || wallet;

      const amount = ethers.formatUnits(value, decimals);
      const direction = fromTracked ? "OUTGOING" : "INCOMING";

      const message = [
        `*ERC20 Transfer 🚨*`,
        `Wallet: \`${label}\``,
        `Type: *${direction}*`,
        `Token: *${symbol}*`,
        `Amount: *${amount}*`,
        `From: \`${from}\``,
        `To: \`${to}\``,
        `Tx: \`${event.log.transactionHash}\``,
      ].join("\n");

      await sendTelegramMessage(message);
    });
  }
}

module.exports = { startErc20Tracker };