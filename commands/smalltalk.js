const { hasName, chatting, newChat } = require("../lib/ai.js");

module.exports = async (bot, embed, data) => {
  const userId = data.member.user.id;
  if (!hasName(userId)) {
    await bot.slash.post(data.id, data.token, embed(
      "Please set your name with the `/name` command first!", true
    ));
    return;
  }
  if (chatting(userId) != null) {
    await bot.slash.post(data.id, data.token, embed(
      "You already have one ongoing Small Talk!", true
    ));
    return;
  }

  await bot.slash.post(data.id, data.token, embed("Creating new chat..."));
  const chat = await bot.interactions.getOriginal(data.token);
  const name = (data.member.nick ?? data.member.user.global_name) ?? data.member.user.username;

  const thread = await bot.threads.startFrom(chat.channel_id, chat.id, { "name": "Small Talk with " + name });
  await bot.threadMembers.put(thread.id, userId);
  await bot.interactions.patch(data.token, embed(
    await newChat(userId, thread.id, chat.channel_id, chat.id)
  ));
};
