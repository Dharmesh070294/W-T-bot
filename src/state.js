const seenSwapTxs = new Map();
const TTL_MS = 30 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [txHash, ts] of seenSwapTxs.entries()) {
    if (now - ts > TTL_MS) {
      seenSwapTxs.delete(txHash);
    }
  }
}

function markSwapTx(txHash) {
  cleanup();
  seenSwapTxs.set(txHash.toLowerCase(), Date.now());
}

function isSwapTx(txHash) {
  cleanup();
  return seenSwapTxs.has(txHash.toLowerCase());
}

module.exports = {
  markSwapTx,
  isSwapTx,
};