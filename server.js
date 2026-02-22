const express = require("express");
const cors = require("cors");
const { Agent } = require("https");
const GigaChat = require("gigachat").default;
require("dotenv").config({ path: ".env.local" });

const app = express();
app.use(cors());
app.use(express.json());

const httpsAgent = new Agent({
  rejectUnauthorized: false,
});

const client = new GigaChat({
  timeout: 60000,
  model: "GigaChat",
  credentials: process.env.GIGACHAT_AUTH_KEY,
  httpsAgent: httpsAgent,
  scope: "GIGACHAT_API_PERS",
});

app.post("/api/chat", async (req, res) => {
  console.log("Запрос к GigaChat:", req.body.message);
  try {
    const response = await client.chat({
      messages: [{ role: "user", content: req.body.message }],
    });

    res.json({
      text: response.choices[0]?.message.content || "Пустой ответ от модели",
    });
  } catch (error) {
    console.error("Ошибка сервера GigaChat:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/giga-auth", async (req, res) => {
  try {
    const models = await client.getModels();
    res.json(models);
  } catch (error) {
    console.error("Ошибка авторизации:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
});
