# Nihongo Bot
A discord bot for learning Japanese through Small Talks.

# Commands:
* `/name` - set your name
* `/smalltalk` - create a Small Talk topic based on your skills

# Installation
1. Clone the repo.
2. Run `npm install`.
3. Create a discord bot, put token into `.token` file.
4. Register with OpenAI, put the API key into `.key` file.
5. Run and enjoy learning!

# Flow
1. You run `/smalltalk` on a discord server.
2. Bot posts a topic starter and creates a thread.
3. Bot listens for your messages inside that thread.
4. When conversation is over, bot evaluates your progress, posts it and archives the thread.
5. If you run `/cancel`, the Small Talk get's cancelled and the thread becomes archived.

# Method
The bot uses `gpt-4o` under the hood.

The bot collects each users proficiency level in specific small talk topics as a value between 0 and 100.
Each new Small Talk introduces a topic based on these levels with a carefully crafted prompt.

The bot records 5 previous topics, so that the topics do not get too repeating.
