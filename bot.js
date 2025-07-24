import TelegramBot from 'node-telegram-bot-api';
import { Configuration, OpenAIApi } from 'openai';
import dotenv from 'dotenv';
import { saveProgress, getProgress } from './db.js';

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

const openai = new OpenAIApi(
  new Configuration({ apiKey: process.env.OPENAI_API_KEY })
);

const sessions = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `Hi ${msg.from.first_name}! 📚  
Which topic would you like to study?`
  );
});

bot.onText(/\/progress/, (msg) => {
  const chatId = msg.chat.id;

  getProgress(String(chatId), (rows) => {
    if (rows.length === 0) {
      bot.sendMessage(chatId, `No progress yet. Start learning with /start!`);
    } else {
      const text = rows
        .map(
          (r) =>
            `${r.date} — Topic: ${r.topic}, Score: ${r.score}/3`
        )
        .join('\n');
      bot.sendMessage(chatId, `📈 Your recent progress:\n${text}`);
    }
  });
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (text.startsWith('/')) return;

  if (!sessions[chatId]) {
    sessions[chatId] = { topic: text, score: 0, question: 0 };
    const summary = await getSummary(text);
    bot.sendMessage(
      chatId,
      `📝 Here’s a quick summary of *${text}*: \n\n${summary}\n\nLet’s start the quiz!`
    );
    sendQuestion(chatId);
  } else if (sessions[chatId].question > 0) {
    if (/a|b|c|d/i.test(text)) {
      sessions[chatId].score += 1; // naive — assumes all answers correct
      if (sessions[chatId].question >= 3) {
        bot.sendMessage(
          chatId,
          `🎉 Session complete! You scored ${sessions[chatId].score}/3 on *${sessions[chatId].topic}*`
        );
        saveProgress(
          String(chatId),
          sessions[chatId].topic,
          sessions[chatId].score
        );
        delete sessions[chatId];
      } else {
        sendQuestion(chatId);
      }
    } else {
      bot.sendMessage(chatId, `Please answer with a, b, c, or d.`);
    }
  }
});

async function sendQuestion(chatId) {
  const session = sessions[chatId];
  session.question += 1;

  const question = await getQuestion(session.topic);

  bot.sendMessage(chatId, `❓ Question ${session.question}: \n${question}`);
}

async function getSummary(topic) {
  const prompt = `Give me a concise summary of the topic: ${topic}. Keep it under 100 words.`;
  const res = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt,
    max_tokens: 150
  });
  return res.data.choices[0].text.trim();
}

async function getQuestion(topic) {
  const prompt = `Create one multiple-choice quiz question about ${topic} with 4 options (a, b, c, d). Mark the correct answer clearly.`;
  const res = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt,
    max_tokens: 150
  });
  return res.data.choices[0].text.trim();
}
