const { chatting, cancelChat } = require("../lib/ai.js");

module.exports = async (bot, embed, data) => {
  const userId = data.member.user.id;
  const chat = chatting(userId);
  if (chat == null) {
    await bot.slash.post(data.id, data.token, embed(
      "You have no ongoing Small Talks yet!", true
    ));
    return;
  }

  await bot.slash.post(data.id, data.token, embed("Cancelling...", true));

  const { ocid, omid, first } = cancelChat(userId);
  await bot.channels.patch(chat, { "archived": true });
  await bot.messages.patch(ocid, omid, embed(first + "\n\n_This Small Talk has been cancelled_"));

  await bot.interactions.patch(data.token, embed("Cancelled", true));
};
