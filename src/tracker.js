const { ethers } = require("ethers");
const {
  WALLET_RPC_URL,
  TRACKED_WALLETS,
  WALLET_LABELS,
  SMART_MONEY_WALLETS,
} = require("./config");
const { sendTelegramMessage } = require("./telegram");
const { isSwapTx } = require("./state");

function lc(value) {
  return value?.toLowerCase() || null;
}

function formatEth(value) {
  return ethers.formatEther(value ?? 0n);
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

async function startTracker() {
  const provider = new ethers.JsonRpcProvider(WALLET_RPC_URL);

  const network = await provider.getNetwork();
  console.log("[wallet] chainId:", network.chainId.toString(), "name:", network.name);

  const trackedWalletsLc = TRACKED_WALLETS.map((w) => lc(w));
  const trackedWalletSet = new Set(trackedWalletsLc);
  const smartMoneySet = new Set((SMART_MONEY_WALLETS || []).map((w) => lc(w)));

  const lastBalances = new Map();
  const lastAlertedTx = new Map();
  let blockBusy = false;

  console.log("Tracking wallets:", TRACKED_WALLETS);

  for (const wallet of trackedWalletsLc) {
    const bal = await withRetry(() => provider.getBalance(wallet), 2, 700);
    lastBalances.set(wallet, bal);
  }

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

      if (!block || !Array.isArray(block.transactions)) {
        return;
      }

      const txsByWallet = new Map();
      for (const wallet of trackedWalletsLc) {
        txsByWallet.set(wallet, []);
      }

      for (const tx of block.transactions) {
        if (!tx || !tx.hash || !tx.from) continue;

        const from = lc(tx.from);
        const to = lc(tx.to);

        if (from && trackedWalletSet.has(from)) {
          txsByWallet.get(from).push(tx);
        }

        if (to && trackedWalletSet.has(to) && to !== from) {
          txsByWallet.get(to).push(tx);
        }
      }

      for (const wallet of trackedWalletsLc) {
        const oldBalance = lastBalances.get(wallet);
        const newBalance = await withRetry(() => provider.getBalance(wallet), 2, 700);

        if (oldBalance === undefined) {
          lastBalances.set(wallet, newBalance);
          continue;
        }

        const diffWei = newBalance - oldBalance;

        if (diffWei === 0n) {
          continue;
        }

        const absDiffWei = diffWei < 0n ? -diffWei : diffWei;
        const direction =
          diffWei < 0n ? "OUTGOING / SPENT" : "INCOMING / RECEIVED";

        const baseLabel =
          WALLET_LABELS?.[wallet] ||
          WALLET_LABELS?.[TRACKED_WALLETS.find((w) => lc(w) === wallet)] ||
          wallet;

        const isSmart = smartMoneySet.has(wallet);
        const label = isSmart ? `${baseLabel} 🧠 SMART MONEY` : baseLabel;

        const candidates = txsByWallet.get(wallet) || [];

        let matchedTx = null;
        let matchedReceipt = null;

        for (const tx of candidates) {
          const from = lc(tx.from);
          const to = lc(tx.to);

          const isOutgoing = diffWei < 0n && from === wallet;
          const isIncoming = diffWei > 0n && to === wallet;

          if (!isOutgoing && !isIncoming) {
            continue;
          }

          try {
            const receipt = await withRetry(
              () => provider.getTransactionReceipt(tx.hash),
              2,
              800
            );

            if (!receipt || receipt.status !== 1) {
              continue;
            }

            matchedTx = tx;
            matchedReceipt = receipt;
            break;
          } catch (error) {
            console.error(`Could not fetch receipt for ${tx.hash}:`, error.message);
          }
        }

        if (!matchedTx) {
  const message = [
    `🚨 *Wallet Activity Alert*${isSmart ? " 🧠 SMART MONEY" : ""}`,
    `Wallet: \`${label}\``,
    `Type: *${direction}*`,
    `Amount Changed: *${formatEth(absDiffWei)} ETH*`,
    ``,
    `Balance:`,
    `Old → *${formatEth(oldBalance)} ETH*`,
    `New → *${formatEth(newBalance)} ETH*`,
    ``,
    `Block: ${blockNumber}`,
  ].join("\n");

  console.log("Balance changed for:", wallet);
  await sendTelegramMessage(message);

  lastBalances.set(wallet, newBalance);
  continue;
}

        const tx = matchedTx;
        const receipt = matchedReceipt;
        const txHash = tx.hash;
        const from = lc(tx.from);
        const to = lc(tx.to);

        if (lastAlertedTx.get(wallet) === txHash) {
          lastBalances.set(wallet, newBalance);
          continue;
        }

        const fromTracked = trackedWalletSet.has(from);
        const toTracked = trackedWalletSet.has(to);

        if (fromTracked && toTracked && wallet !== from) {
          lastBalances.set(wallet, newBalance);
          continue;
        }

        if (isSwapTx(txHash)) {
          lastBalances.set(wallet, newBalance);
          continue;
        }

        let counterparty = "Unknown";
        let valueSent = "Unknown";
        let gasSpent = "Unknown";

        if (from === wallet && to === wallet) {
          counterparty = wallet;
          valueSent = formatEth(tx.value ?? 0n);

          const gasPrice =
            receipt?.effectiveGasPrice ??
            tx.gasPrice ??
            tx.maxFeePerGas ??
            null;

          if (receipt?.gasUsed != null && gasPrice != null) {
            gasSpent = formatEth(receipt.gasUsed * gasPrice);
          }
        } else if (from === wallet) {
          counterparty = tx.to || "Contract Creation";
          valueSent = formatEth(tx.value ?? 0n);

          const gasPrice =
            receipt?.effectiveGasPrice ??
            tx.gasPrice ??
            tx.maxFeePerGas ??
            null;

          if (receipt?.gasUsed != null && gasPrice != null) {
            gasSpent = formatEth(receipt.gasUsed * gasPrice);
          }
        } else if (to === wallet) {
          counterparty = tx.from || "Unknown Sender";
          valueSent = formatEth(tx.value ?? 0n);
          gasSpent = "0";
        }

        const message = [
  `🚨 *Wallet Activity Alert*${isSmart ? " 🧠 SMART MONEY" : ""}`,
  `Wallet: \`${label}\``,
  `Type: *${direction}*`,
  `Amount Changed: *${formatEth(absDiffWei)} ETH*`,
  ``,
  `Balance:`,
  `Old → *${formatEth(oldBalance)} ETH*`,
  `New → *${formatEth(newBalance)} ETH*`,
  ``,
  `Block: ${blockNumber}`,
].join("\n");

        console.log("Balance changed for:", wallet);
        await sendTelegramMessage(message);

        lastAlertedTx.set(wallet, txHash);
        lastBalances.set(wallet, newBalance);
      }
    } catch (error) {
      console.error(`Error on block ${blockNumber}:`, error.message);
    } finally {
      blockBusy = false;
    }
  });
}

module.exports = { startTracker };