const fs = require("fs");
const { setName } = require("../lib/ai.js");

module.exports = async (bot, embed, data) => {
  const name = data.data.options.find(o => o.name == "name").value.trim();

  const userId = data.member.user.id;
  setName(userId, name);
  await bot.slash.post(data.id, data.token, embed(
    "Name set to '" + name + "'. This name will be used in all future chats.", true
  ));
}
