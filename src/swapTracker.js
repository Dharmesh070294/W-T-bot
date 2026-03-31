const { ethers } = require("ethers");
const {
  SWAP_RPC_URL,
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

function lc(value) {
  return value?.toLowerCase() || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, retries = 3, baseDelay = 700) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const msg = String(error?.message || "");
      const isRateLimit =
        msg.includes("Too Many Requests") ||
        msg.includes("429") ||
        msg.includes("-32005");

      if (!isRateLimit || attempt === retries) {
        throw error;
      }

      await sleep(baseDelay * (attempt + 1));
    }
  }

  throw lastError;
}

async function runWithConcurrency(items, limit, worker) {
  let index = 0;

  async function next() {
    while (index < items.length) {
      const current = items[index++];
      await worker(current);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => next()
  );

  await Promise.all(workers);
}

async function startSwapTracker() {
  const provider = new ethers.JsonRpcProvider(SWAP_RPC_URL);

  const trackedWalletSet = new Set(TRACKED_WALLETS.map((w) => lc(w)));
  const smartMoneySet = new Set((SMART_MONEY_WALLETS || []).map((w) => lc(w)));

  const processedTxs = new Set();
  let blockBusy = false;

  console.log("Swap tracker started...");

const network = await provider.getNetwork();
console.log("[swap] chainId:", network.chainId.toString(), "name:", network.name);

  provider.on("block", async (blockNumber) => {
    if (blockBusy) return;
    blockBusy = true;
    
    try {
      
      await sleep(500);

      const block = await withRetry(
        () => provider.getBlock(blockNumber, true),
        2,
        800
      );

      if (!block || !Array.isArray(block.transactions) || block.transactions.length === 0) {
        return;
      }

      const candidates = block.transactions.filter((tx) => {
        if (!tx || !tx.hash || !tx.from) return false;

        const from = lc(tx.from);
        return trackedWalletSet.has(from);
      });

      if (candidates.length === 0) {
        return;
      }

      await runWithConcurrency(candidates, 2, async (tx) => {
        try {
          if (processedTxs.has(tx.hash)) return;

          const from = lc(tx.from);
          const to = lc(tx.to);

          const receipt = await withRetry(
            () => provider.getTransactionReceipt(tx.hash),
            2,
            800
          );

          if (!receipt) return;

          const decoded = await withRetry(
            () => decodeSwapFromReceipt(provider, receipt, from),
            1,
            500
          );

          const hasSwapData =
            (Array.isArray(decoded?.sent) && decoded.sent.length > 0) ||
            (Array.isArray(decoded?.received) && decoded.received.length > 0);

          if (!hasSwapData) {
            return;
          }

          markSwapTx(tx.hash);

          const label =
            WALLET_LABELS?.[from] ||
            WALLET_LABELS?.[tx.from] ||
            from;

          const router = KNOWN_ROUTERS[to] || tx.to || "Unknown Router/Contract";
          const isSmart = smartMoneySet.has(from);
          const smartTag = isSmart ? " 🧠 SMART MONEY" : "";

          const sentText =
            Array.isArray(decoded?.sent) && decoded.sent.length > 0
              ? decoded.sent.map((x) => `${x.formatted} ${x.symbol}`).join(", ")
              : tx.value && tx.value > 0n
              ? `${ethers.formatEther(tx.value)} ETH`
              : "N/A";

          const receivedText =
            Array.isArray(decoded?.received) && decoded.received.length > 0
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

          processedTxs.add(tx.hash);

          if (processedTxs.size > 10000) {
            processedTxs.clear();
          }
        } catch (error) {
          console.error("Swap decode error:", error.message);
        }
      });
    } catch (error) {
      console.error(`Swap tracker block error ${blockNumber}:`, error.message);
    } finally {
      blockBusy = false;
    }
  });
}

module.exports = { startSwapTracker };