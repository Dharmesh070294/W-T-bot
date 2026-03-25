const { sendTelegramMessage } = require("./telegram");
const { startTracker } = require("./tracker");
const { startErc20Tracker } = require("./erc20Tracker");
const { startSwapTracker } = require("./swapTracker");

async function main() {
  try {
    await sendTelegramMessage("Wallet tracker bot started.");
    await startTracker();
    await startErc20Tracker();
    await startSwapTracker();
    console.log("Wallet tracker running...");
  } catch (error) {
    console.error("Startup error:", error);
  }
}

main();