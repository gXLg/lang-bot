const { Bot, utils, consts } = require("nullcord");
const { sigint } = require("gxlg-utils");
const fs = require("fs");
const token = fs.readFileSync(".token", "utf-8").trim();
const parameters = require("./lib/parameters.js");
const { continueChat, endChat } = require("./lib/ai.js");
const embed = require("./lib/embed.js");

(async () => {

  const bot = new Bot(token, { "internal": true });
  await utils.updateCommands(bot, "./commands/list.json");
  const botUser = await bot.self.getUser();

  bot.events["READY"] = async data => {
    if (bot.ready()) {
      bot.logger.info("Bot logged in as", botUser.username);
      delete bot.events["READY"];
    }
  };

  bot.events["INTERACTION_CREATE"] = async data => {
    if (data.type != 2) return;
    if (!data.guild_id) {
      await bot.slash.post(data.id, data.token, embed("Can't use bot commands in DMs!", true));
      return;
    }

    const name = data.data.name;
    try {
      bot.logger.info("Executing application command", name);
      const run = require("./commands/" + name + ".js");
      const args = parameters(run).map(p => eval(p));
      await run(...args);
    } catch (error) {
      bot.logger.error("Execution of", name, "failed");
      bot.logger.error(error);
      const message = embed("Internal error occured:\n" + error, true);
      const msg = await bot.slash.post(data.id, data.token, message);
      if (msg.code) await bot.interactions.patch(data.token, message);
    }
  };

  const waiting = new Set();
  bot.events["MESSAGE_CREATE"] = async msg => {
    const data = await continueChat(msg.author.id, msg.channel_id, msg.content, waiting);
    if (data == null) return;

    const message =
      ":brain: (" + data.understanding + ")\n\n" +
      (data.feedback ? ":bulb: " + data.feedback + "\n\n" : "") +
      ":arrow_right_hook: " + data.romaji + "\n\n" +
      "||" + data.english + "||";

    if (!data.finished) {
      await bot.messages.post(msg.channel_id, embed(message));
    } else {
      const { first, final, ocid, omid } = await endChat(msg.author.id, msg.channel_id);
      await bot.messages.post(msg.channel_id, embed(message + final));
      await bot.channels.patch(msg.channel_id, { "archived": true });
      await bot.messages.patch(ocid, omid, embed(first + final));
    }
  };

  sigint(async () => {
    await bot.destroy();
  })

  await bot.login(utils.autoIntents({ bot, "message_content": true }));

})();
