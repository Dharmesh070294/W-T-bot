const { ethers } = require("ethers");
const {
  RPC_URL,
  TRACKED_WALLETS,
  WALLET_LABELS,
  SMART_MONEY_WALLETS,
} = require("./config");
const { sendTelegramMessage } = require("./telegram");
const { isSwapTx } = require("./state");

async function findWalletTxInBlock(provider, blockNumber, wallet) {
  const block = await provider.getBlock(blockNumber);
  if (!block || !block.transactions || block.transactions.length === 0) return null;

  const target = wallet.toLowerCase();

  for (let i = block.transactions.length - 1; i >= 0; i--) {
    const txHash = block.transactions[i];

    try {
      const tx = await provider.getTransaction(txHash);
      if (!tx) continue;

      const from = tx.from?.toLowerCase();
      const to = tx.to?.toLowerCase();

      if (from === target || to === target) {
        return tx;
      }
    } catch {
      // ignore per-tx fetch failures
    }
  }

  return null;
}

async function startTracker() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  console.log("Tracking wallets:", TRACKED_WALLETS);

  const lastBalances = new Map();
  const walletBusy = new Set();
  const lastAlertedTx = new Map();

  for (const wallet of TRACKED_WALLETS) {
    const bal = await provider.getBalance(wallet);
    lastBalances.set(wallet, bal);
  }

  provider.on("block", async (blockNumber) => {
    try {
      for (const wallet of TRACKED_WALLETS) {
        if (walletBusy.has(wallet)) continue;
        walletBusy.add(wallet);

        try {
          const newBalance = await provider.getBalance(wallet);
          const oldBalance = lastBalances.get(wallet);

          if (oldBalance === undefined) {
            lastBalances.set(wallet, newBalance);
            continue;
          }

          if (newBalance === oldBalance) continue;

          const baseLabel = WALLET_LABELS?.[wallet] || wallet;
          const isSmart = SMART_MONEY_WALLETS?.includes(wallet);
          const label = isSmart ? `${baseLabel} 🧠 SMART MONEY` : baseLabel;

          const diffWei = newBalance - oldBalance;
          const absDiffWei = diffWei < 0n ? -diffWei : diffWei;
          const direction = diffWei < 0n ? "OUTGOING / SPENT" : "INCOMING / RECEIVED";

          let valueSent = "N/A";
          let gasSpent = "N/A";
          let counterparty = "N/A";
          let txHash = "N/A";

          try {
            const tx = await findWalletTxInBlock(provider, blockNumber, wallet);

            if (tx) {
              txHash = tx.hash;

              if (lastAlertedTx.get(wallet) === txHash) {
                lastBalances.set(wallet, newBalance);
                continue;
              }

              const from = tx.from?.toLowerCase();

              if (from === wallet.toLowerCase()) {
                counterparty = tx.to || "Contract Creation";
              } else {
                counterparty = tx.from || "Unknown Sender";
              }

              valueSent = ethers.formatEther(tx.value ?? 0n);

              if (from === wallet.toLowerCase()) {
                const receipt = await provider.getTransactionReceipt(tx.hash);
                const gasPrice =
                  receipt?.effectiveGasPrice ??
                  tx.gasPrice ??
                  tx.maxFeePerGas ??
                  null;

                if (receipt?.gasUsed != null && gasPrice != null) {
                  const gasCostWei = receipt.gasUsed * gasPrice;
                  gasSpent = ethers.formatEther(gasCostWei);
                }
              } else {
                gasSpent = "0";
              }
            }

            // If swapTracker already handled this tx, skip duplicate balance alert
            if (txHash !== "N/A" && isSwapTx(txHash)) {
              lastBalances.set(wallet, newBalance);
              continue;
            }

            const message = [
              `*Wallet Balance Change Alert*${isSmart ? " 🧠 SMART MONEY" : ""}`,
              `Wallet: \`${label}\``,
              `Type: *${direction}*`,
              `Total Change: *${ethers.formatEther(absDiffWei)} ETH*`,
              `Value Sent/Received: *${valueSent} ETH*`,
              `Gas Spent: *${gasSpent} ETH*`,
              `Counterparty: \`${counterparty}\``,
              `Tx Hash: \`${txHash}\``,
              `Old Balance: *${ethers.formatEther(oldBalance)} ETH*`,
              `New Balance: *${ethers.formatEther(newBalance)} ETH*`,
              `Block: ${blockNumber}`,
            ].join("\n");

            console.log("Balance changed for:", wallet);
            await sendTelegramMessage(message);

            if (txHash !== "N/A") {
              lastAlertedTx.set(wallet, txHash);
            }
          } catch (error) {
            console.error(`Could not fetch tx details in block ${blockNumber}:`, error.message);
          }

          lastBalances.set(wallet, newBalance);
        } finally {
          walletBusy.delete(wallet);
        }
      }
    } catch (error) {
      console.error(`Error on block ${blockNumber}:`, error.message);
    }
  });
}

module.exports = { startTracker };