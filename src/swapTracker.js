const { ethers } = require("ethers");
const {
  RPC_URL,
  TRACKED_WALLETS,
  WALLET_LABELS,
  SMART_MONEY_WALLETS,
} = require("./config");
const { sendTelegramMessage } = require("./telegram");
const { decodeSwapFromReceipt } = require("./swapDecoder");
const { markSwapTx } = require("./state");

const KNOWN_ROUTERS = {
  "0x3a9d48ab9751398bbfa63ad67599bb04e4bdf98b": "Test Router",
};

async function startSwapTracker() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  console.log("Swap tracker started...");

  provider.on("block", async (blockNumber) => {
    try {
      const block = await provider.getBlock(blockNumber);
      if (!block || !block.transactions) return;

      for (const txHash of block.transactions) {
        try {
          const tx = await provider.getTransaction(txHash);
          if (!tx || !tx.from || !tx.to) continue;

          const from = tx.from.toLowerCase();
          const to = tx.to.toLowerCase();

          if (!TRACKED_WALLETS.includes(from)) continue;
          if (!KNOWN_ROUTERS[to]) continue;

          const receipt = await provider.getTransactionReceipt(tx.hash);
          const decoded = await decodeSwapFromReceipt(provider, receipt, from);

          markSwapTx(tx.hash);

          const label = WALLET_LABELS?.[from] || from;
          const router = KNOWN_ROUTERS[to];
          const isSmart = SMART_MONEY_WALLETS.includes(from);
          const smartTag = isSmart ? " 🧠 SMART MONEY" : "";

          let sentText =
            decoded.sent.length > 0
              ? decoded.sent.map((x) => `${x.formatted} ${x.symbol}`).join(", ")
              : (tx.value && tx.value > 0n
                  ? `${ethers.formatEther(tx.value)} ETH`
                  : "N/A");

          let receivedText =
            decoded.received.length > 0
              ? decoded.received.map((x) => `${x.formatted} ${x.symbol}`).join(", ")
              : "N/A";

          const gasPrice =
            receipt?.effectiveGasPrice ??
            tx.gasPrice ??
            tx.maxFeePerGas ??
            null;

          const gasSpent =
            receipt?.gasUsed != null && gasPrice != null
              ? ethers.formatEther(receipt.gasUsed * gasPrice)
              : "N/A";

          const message = [
            `*Swap Detected*${smartTag}`,
            `Wallet: \`${label}\``,
            `Router: *${router}*`,
            `Sent: *${sentText}*`,
            `Received: *${receivedText}*`,
            `Gas Spent: *${gasSpent} ETH*`,
            `Tx Hash: \`${tx.hash}\``,
            `Block: ${blockNumber}`,
          ].join("\n");

          console.log("Decoded swap:", tx.hash);
          await sendTelegramMessage(message);
        } catch (error) {
          console.error("Swap decode error:", error.message);
        }
      }
    } catch (error) {
      console.error(`Swap tracker block error ${blockNumber}:`, error.message);
    }
  });
}

module.exports = { startSwapTracker };