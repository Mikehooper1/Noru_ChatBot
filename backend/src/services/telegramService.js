const TelegramBot = require('node-telegram-bot-api');
const { getChannelConfig } = require('../firebase/admin');

const botInstances = new Map();

async function getTelegramBot(businessId) {
  if (botInstances.has(businessId)) return botInstances.get(businessId);

  const config = await getChannelConfig(businessId, 'telegram');
  if (!config?.enabled || !config.botToken) return null;

  const bot = new TelegramBot(config.botToken);
  botInstances.set(businessId, { bot, config });
  return { bot, config };
}

async function answerCallbackQuery(businessId, callbackQueryId) {
  const instance = await getTelegramBot(businessId);
  if (!instance?.bot || !callbackQueryId) return;
  try {
    await instance.bot.answerCallbackQuery(callbackQueryId);
  } catch (error) {
    console.warn('[Telegram] answerCallbackQuery failed:', error.message);
  }
}

async function sendMessage(businessId, chatId, text, inlineKeyboard = null) {
  const instance = await getTelegramBot(businessId);
  if (!instance) throw new Error('Telegram not configured');

  const options = {};
  if (inlineKeyboard?.length) {
    options.reply_markup = {
      inline_keyboard: inlineKeyboard.map((row) =>
        (Array.isArray(row) ? row : [row]).map((btn) => {
          if (typeof btn === 'string') {
            return { text: btn, callback_data: btn };
          }
          const out = { text: btn.text };
          if (btn.url) out.url = btn.url;
          else out.callback_data = btn.callback_data || btn.text;
          return out;
        })
      ),
    };
  }

  return instance.bot.sendMessage(chatId, text, options);
}

async function sendBookingConfirmation(businessId, chatId, appointmentData) {
  const text = `✅ Appointment Confirmed!\n\n` +
    `Service: ${appointmentData.serviceName}\n` +
    `Date: ${appointmentData.date}\n` +
    `Time: ${appointmentData.time}\n` +
    `Duration: ${appointmentData.duration} minutes\n\n` +
    `We look forward to seeing you!`;

  return sendMessage(businessId, chatId, text);
}

async function setupWebhook(businessId, webhookUrl) {
  const instance = await getTelegramBot(businessId);
  if (!instance) return;
  await instance.bot.setWebHook(`${webhookUrl}/webhook/telegram/${businessId}`);
}

function buildInlineKeyboard(quickReplies) {
  if (!quickReplies?.length) return null;
  return quickReplies.map((reply) => [{ text: reply, callback_data: reply }]);
}

function buildPaymentKeyboard(paymentLinks) {
  if (!paymentLinks?.length) return null;
  return paymentLinks.map((link) => [
    { text: `💳 ${link.planName} ₹${link.price}`, url: link.url },
  ]);
}

module.exports = {
  getTelegramBot,
  sendMessage,
  answerCallbackQuery,
  sendBookingConfirmation,
  setupWebhook,
  buildInlineKeyboard,
  buildPaymentKeyboard,
};
