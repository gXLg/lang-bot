module.exports = (text, hidden) => {
  return {
    "embeds": [{ "description": text, "color": 0xBC002D }],
    "flags": (hidden ? 64 : null)
  };
};
