const express = require("express");
const path = require("path");
const { Agent } = require("https");
const GigaChat = require("gigachat").default;
const { QdrantClient } = require("@qdrant/js-client-rest");
const { pipeline } = require("@xenova/transformers");
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

const qdrant = new QdrantClient({ url: "http://localhost:6113" });

// let extractor;
let extractorPromise = pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2"
);

async function getWeatherContext(userQuery) {
  try {
    const extractor = await extractorPromise;

    // 1. Извлекаем дату из запроса (гггг-мм-дд)
    const dateMatch = userQuery.match(/\d{4}-\d{2}-\d{2}/);
    const targetDate = dateMatch ? dateMatch[0] : null;

    // 2. Генерируем вектор для семантического поиска (по городу/типу погоды)
    const output = await extractor(userQuery, {
      pooling: "mean",
      normalize: true,
    });
    const vector = Array.from(output.data);

    // 3. Настраиваем поиск с жестким фильтром по дате
    const searchOptions = {
      vector: vector,
      limit: 15, // Берем все города на эту дату
      with_payload: true,
    };

    // Если дата найдена в запросе, добавляем фильтр
    if (targetDate) {
      searchOptions.filter = {
        must: [{ key: "date", match: { value: targetDate } }],
      };
    }

    const searchResult = await qdrant.search(
      "weather_collection",
      searchOptions
    );

    if (searchResult.length > 0) {
      console.log(
        `🔍 Найдено записей: ${searchResult.length} для даты: ${
          targetDate || "любая"
        }`
      );
      return searchResult.map((res) => res.payload.text).join("\n");
    }

    return "Информации о погоде не найдено.";
  } catch (e) {
    console.error("Ошибка RAG:", e);
    throw e;
  }
}

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const weatherContext = await getWeatherContext(userMessage);

    const response = await client.chat({
      messages: [
        {
          role: "system",
          content: `Ты — погодный эксперт. Твоя задача отвечать на вопросы пользователя, используя только предоставленный контекст. 
          Если в контексте нет данных для ответа, вежливо сообщи об этом.
          
          Контекст из базы данных:
          ${weatherContext}`,
        },
        { role: "user", content: userMessage },
      ],
    });

    res.json({ text: response.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/yandex", async (req, res) => {
  try {
    const response = await fetch(
      "https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
      {
        method: "POST",
        headers: {
          Authorization: `Api-Key ${process.env.YANDEX_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelUri: `gpt://${process.env.YANDEX_FOLDER}/yandexgpt-lite/latest`,
          completionOptions: {
            stream: false,
            temperature: 0.2,
            maxTokens: 2000,
          },
          messages: [
            {
              role: "user",
              text: req.body.message,
            },
          ],
        }),
      }
    );

    const data = await response.json();
    res.json({ text: data.result.alternatives[0].message.text });
  } catch (error) {
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
