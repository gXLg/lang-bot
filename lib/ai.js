const OpenAI = require("openai");
const fs = require("fs");
const apiKey = fs.readFileSync(".key", "utf-8").trim();
const openai = new OpenAI({ apiKey });

function hasName(uid) {
  return fs.existsSync("memories/users/" + uid + ".json");
}

function setName(uid, name) {
  const profName = "memories/users/" + uid + ".json";
  if (!fs.existsSync(profName)) {
    fs.writeFileSync(profName, '{"skills":{},"chatting":false}');
  }
  const prof = JSON.parse(fs.readFileSync(profName));
  prof.name = name;
  fs.writeFileSync(profName, JSON.stringify(prof));
}

function chatting(uid) {
  const prof = JSON.parse(fs.readFileSync("memories/users/" + uid + ".json"));
  return prof.chatting;
}

async function newChat(uid, cid, ocid, omid) {
  const profName = "memories/users/" + uid + ".json";
  const prof = JSON.parse(fs.readFileSync(profName));
  prof.chatting = cid;
  fs.writeFileSync(profName, JSON.stringify(prof));

  const messages = [
    { "role": "system", "content": fs.readFileSync("lib/prompts/system.md", "utf-8") },
    {
      "role": "user",
      "content": "# User's Name\n" + prof.name +
        "\n\n# Proficiency Levels\n" +
        (Object.keys(prof.skills) ? (
          Object.keys(prof.skills).map(s => s + ": " + prof.skills[s]).join("\n")
        ) : "(no skills yet)") +
        "\n\n# Recent Topics\n" +
        (prof.topics?.length ? prof.topics.map(t => "- " + t).join("\n") : "(no recent topics yet)") +
        "\n\n# Recent Character Names\n" +
        (prof.chars?.length ? prof.chars.join(", ") : "(no recent names)")
    }
  ];

  const completion = await openai.chat.completions.create({
    "model": "gpt-4o-2024-08-06", messages
  });

  const content = completion.choices[0].message.content;
  messages.push({ "role": "assistant", content });
  fs.writeFileSync("memories/chats/" + cid + ".json", JSON.stringify({
    "user": uid, messages, ocid, omid
  }));

  const ex = [
    { "role": "system", "content": fs.readFileSync("lib/prompts/extract.md", "utf-8") },
    { "role": "user", content }
  ];
  const comp2 = await openai.beta.chat.completions.parse({
    "model": "gpt-4o-2024-08-06",
    "messages": ex,
    "response_format": {
      "type": "json_schema",
      "json_schema": {
        "name": "response",
        "schema": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "description": "The name of the chatbot character."
            },
            "title": {
              "type": "string",
              "description": "A short but detailed title for the upcoming conversation."
            }
          },
          "required": ["name", "title"],
          "additionalProperties": false
        },
        "strict": true
      }
    }
  });
  const parsed = comp2.choices[0].message.parsed;
  prof.chars = (prof.chars ?? []).concat(parsed.name).slice(-10);
  prof.topics = (prof.topics ?? []).concat(parsed.title).slice(-5);
  fs.writeFileSync(profName, JSON.stringify(prof));

  return content;
}

async function continueChat(uid, cid, newMessage, waiting) {
  if (waiting.has(cid)) return null;
  const chatName = "memories/chats/" + cid + ".json";
  if (!fs.existsSync(chatName)) return null;
  const chat = JSON.parse(fs.readFileSync(chatName));
  if (chat.user != uid) return null;

  waiting.add(cid);
  chat.messages.push({ "role": "user", "content": newMessage });
  const completion = await openai.beta.chat.completions.parse({
    "model": "gpt-4o-2024-08-06",
    "messages": chat.messages,
    "response_format": {
      "type": "json_schema",
      "json_schema": {
        "name": "response",
        "schema": {
          "type": "object",
          "properties": {
            "understanding": {
              "type": "string",
              "description": "Your best guess at what the user meant to say, translated into English."
            },
            "feedback": {
              "type": ["string", "null"],
              "description": "An optional short suggestion in English on how the user could improve their sentence or a tip/praise."
            },
            "romaji": {
              "type": "string",
              "description": "Your response in Romaji."
            },
            "english": {
              "type": "string",
              "description": "The English translation of your response."
            },
            "finished": {
              "type": "boolean",
              "description": "A boolean indicating whether the conversation has naturally reached an end."
            }
          },
          "required": ["understanding", "feedback", "romaji", "english", "finished"],
          "additionalProperties": false
        },
        "strict": true
      }
    }
  });
  const parsed = completion.choices[0].message.parsed;
  chat.messages.push({
    "role": "assistant",
    "content": (parsed.feedback ? "(Feedback: " + parsed.feedback + ")\n\n" : "") +
      parsed.romaji
  });
  fs.writeFileSync("memories/chats/" + cid + ".json", JSON.stringify(chat));
  waiting.delete(cid);
  return parsed;
}

async function endChat(uid, cid) {
  const chatName = "memories/chats/" + cid + ".json";
  const profName = "memories/users/" + uid + ".json";

  const chat = JSON.parse(fs.readFileSync(chatName));
  chat.messages.push({ "role": "user", "content": fs.readFileSync("lib/prompts/analyze.md", "utf-8") });
  const completion = await openai.beta.chat.completions.parse({
    "model": "gpt-4o-2024-08-06",
    "messages": chat.messages,
    "temperature": 0.4,
    "response_format": {
      "type": "json_schema",
      "json_schema": {
        "name": "response",
        "schema": {
          "type": "object",
          "properties": {
            "skills": {
              "type": "array",
              "description": "Array of proficiency level changes in different small talk skills.",
              "items": {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string",
                    "description": "The skill name.",
                  },
                  "diff": {
                    "type": "integer",
                    "enum": [-2, -1, 1, 2, 3],
                    "description": "The difference in proficiency level."
                  }
                },
                "required": ["name", "diff"],
                "additionalProperties": false
              }
            },
          },
          "required": ["skills"],
          "additionalProperties": false
        },
        "strict": true
      }
    }
  });

  const prof = JSON.parse(fs.readFileSync(profName));
  const changes = {};
  const all = Object.keys(prof.skills);
  for (const { name, diff } of completion.choices[0].message.parsed.skills) {
    changes[name] = diff;
    if (!all.includes(name)) all.push(name);
  }

  const final = [];
  for (const name of all) {
    const old = prof.skills[name] ?? 0;
    const diff = changes[name] ?? 0;
    const level = Math.max(0, Math.min(100, old + diff));
    const d = level - old;
    if (d == 0) {
      final.push(":white_small_square: " + name + ": " + level);
    } else {
      final.push(
        (d > 0 ? ":chart_with_upwards_trend: " : ":chart_with_downwards_trend: ") +
        name + ": " + level + " (" + (d > 0 ? "+" : "") + d + ")"
      );
    }
    prof.skills[name] = level;
  }
  prof.chatting = null;
  fs.writeFileSync(profName, JSON.stringify(prof));
  fs.unlinkSync(chatName);
  return {
    "first": chat.messages[2].content,
    "ocid": chat.ocid, "omid": chat.omid,
    "final": "\n\nChat ended, stats:\n" + final.join("\n")
  };
}

function cancelChat(uid) {
  const profName = "memories/users/" + uid + ".json";
  const prof = JSON.parse(fs.readFileSync(profName));

  const chatName = "memories/chats/" + prof.chatting + ".json";
  const chat = JSON.parse(fs.readFileSync(chatName));

  prof.chatting = null;
  fs.writeFileSync(profName, JSON.stringify(prof));
  fs.unlinkSync(chatName);

  return {
    "first": chat.messages[2].content,
    "ocid": chat.ocid, "omid": chat.omid
  };

}

module.exports = {
  setName, hasName, chatting,
  newChat, continueChat, endChat, cancelChat
};
