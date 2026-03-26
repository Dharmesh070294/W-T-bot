let activeSwapDecodes = 0;
const MAX_ACTIVE_SWAP_DECODES = 3;

async function withSwapLimit(fn) {
  while (activeSwapDecodes >= MAX_ACTIVE_SWAP_DECODES) {
    await new Promise((r) => setTimeout(r, 100));
  }

  activeSwapDecodes += 1;
  try {
    return await fn();
  } finally {
    activeSwapDecodes -= 1;
  }
}

module.exports = { withSwapLimit };