const axios = require("axios");
require("dotenv").config();

async function sendTelegramMessage(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await axios.post(url, {
      chat_id: chatId,
      text: message,
    });

    console.log("Telegram sent:", res.data);
  } catch (error) {
    console.error("Telegram error:", error.response?.data || error.message);
  }
}

module.exports = { sendTelegramMessage };