const seenSwapTxs = new Set();

function markSwapTx(txHash) {
  seenSwapTxs.add(txHash.toLowerCase());
}

function isSwapTx(txHash) {
  return seenSwapTxs.has(txHash.toLowerCase());
}

module.exports = {
  markSwapTx,
  isSwapTx,
};