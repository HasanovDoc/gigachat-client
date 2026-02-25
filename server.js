const express = require("express");
const path = require("path");
const { Agent } = require("https");
const GigaChat = require("gigachat").default;
require("dotenv").config({ path: ".env.local" });

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, "dist")));

const httpsAgent = new Agent({ rejectUnauthorized: false });
const client = new GigaChat({
  credentials: process.env.GIGACHAT_AUTH_KEY,
  httpsAgent: httpsAgent,
  scope: "GIGACHAT_API_PERS",
});

app.post("/api/chat", async (req, res) => {
  try {
    const response = await client.chat({
      messages: [{ role: "user", content: req.body.message }],
    });

    const message = response.choices[0].message;

    res.json({ text: message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Production server is running on port ${PORT}`);
});
