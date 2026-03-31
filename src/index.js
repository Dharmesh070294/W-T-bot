require("dotenv").config();

const { validateEnv } = require("./validateEnv");
const { startTracker } = require("./tracker");
const { startSwapTracker } = require("./swapTracker");
const { sendTelegramMessage } = require("./telegram");

validateEnv();

async function main() {
  try {
    await sendTelegramMessage("Wallet tracker bot started.");
    startTracker();
    startSwapTracker();
    console.log("Both trackers are running...");
  } catch (error) {
    console.error("Startup error:", error.message);
  }
}

main();