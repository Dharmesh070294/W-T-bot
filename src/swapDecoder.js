const { ethers } = require("ethers");

const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

const transferTopic = ethers.id("Transfer(address,address,uint256)");

async function getTokenMeta(provider, tokenAddress) {
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([
      contract.symbol().catch(() => "TOKEN"),
      contract.decimals().catch(() => 18),
    ]);
    return { symbol, decimals };
  } catch {
    return { symbol: "TOKEN", decimals: 18 };
  }
}

async function decodeSwapFromReceipt(provider, receipt, walletAddress) {
  const wallet = walletAddress.toLowerCase();

  const sent = [];
  const received = [];

  for (const log of receipt.logs) {
    if (!log.topics || log.topics[0] !== transferTopic) continue;
    if (log.topics.length < 3) continue;

    const from = ethers.getAddress("0x" + log.topics[1].slice(26)).toLowerCase();
    const to = ethers.getAddress("0x" + log.topics[2].slice(26)).toLowerCase();

    const tokenAddress = log.address;
    const value = BigInt(log.data);

    const meta = await getTokenMeta(provider, tokenAddress);

    const item = {
      token: tokenAddress,
      symbol: meta.symbol,
      decimals: meta.decimals,
      rawValue: value,
      formatted: ethers.formatUnits(value, meta.decimals),
    };

    if (from === wallet) sent.push(item);
    if (to === wallet) received.push(item);
  }

  return { sent, received };
}

module.exports = { decodeSwapFromReceipt };