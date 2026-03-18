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

let extractorPromise = pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2"
);

const TODAY = new Date().toISOString().split("T")[0];
const YESTERDAY = new Date(Date.now() - 86400000).toISOString().split("T")[0];

async function getWeatherContext(userQuery) {
  try {
    const extractor = await extractorPromise;
    const queryLower = userQuery.toLowerCase();
    let targetDate = null;

    if (queryLower.includes("сегодня")) {
      targetDate = TODAY;
    } else if (queryLower.includes("вчера")) {
      targetDate = YESTERDAY;
    } else {
      const dateMatch = userQuery.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) targetDate = dateMatch[0];
    }

    const output = await extractor(userQuery, {
      pooling: "mean",
      normalize: true,
    });
    const vector = Array.from(output.data);

    const searchParams = {
      vector: vector,
      limit: 15,
      with_payload: true,
    };

    if (targetDate) {
      searchParams.filter = {
        must: [{ key: "date", match: { value: targetDate } }],
      };
    }

    const searchResult = await qdrant.search(
      "weather_collection",
      searchParams
    );

    if (searchResult.length > 0) {
      return searchResult.map((res) => res.payload.text).join("\n");
    }
    return null;
  } catch (e) {
    console.error("RAG Error:", e);
    return null;
  }
}

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const weatherContext = await getWeatherContext(userMessage);

    let prompt;
    if (weatherContext) {
      prompt = `Используй ТОЛЬКО эти данные о погоде:
${weatherContext}

Вопрос: ${userMessage}
Сегодня: ${TODAY}. Ответ:`;
    } else {
      prompt = `Пользователь спрашивает: "${userMessage}". 
      К сожалению, в нашей базе данных нет информации на этот запрос. 
      Ответь вежливо, что данных о погоде на этот период нет.`;
    }

    const response = await client.chat({
      model: "GigaChat",
      messages: [{ role: "user", content: prompt }],
    });

    res.json({ text: response.choices[0].message.content });
  } catch (error) {
    console.error("API Error:", error.message);
    res.status(500).json({ error: "Ошибка нейросети" });
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
