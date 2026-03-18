const { QdrantClient } = require("@qdrant/js-client-rest");
const { pipeline } = require("@xenova/transformers");
require("dotenv").config({ path: ".env.local" });

const qdrant = new QdrantClient({ url: "http://localhost:6113" });
const collectionName = "weather_collection";

const cities = [
  "Москва",
  "Санкт-Петербург",
  "Казань",
  "Сочи",
  "Новосибирск",
  "Екатеринбург",
  "Нижний Новгород",
  "Самара",
  "Омск",
  "Ростов-на-Дону",
  "Уфа",
  "Красноярск",
  "Воронеж",
  "Пермь",
  "Волгоград",
];

const weatherTypes = [
  "солнечно",
  "облачно",
  "пасмурно",
  "дождь",
  "снег",
  "туман",
  "ветрено",
];

async function setup() {
  try {
    const extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );

    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === collectionName
    );

    if (exists) {
      await qdrant.deleteCollection(collectionName);
      console.log("🗑 Старая коллекция удалена");
    }

    await qdrant.createCollection(collectionName, {
      vectors: { size: 384, distance: "Cosine" },
    });

    console.log("📦 Генерация данных на 2026 год...");

    const startDate = new Date("2026-01-01");
    let points = [];
    let idCounter = 1;

    for (let day = 0; day < 365; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + day);
      const month = currentDate.getMonth() + 1;
      const dateStr = currentDate.toISOString().split("T")[0];

      for (const city of cities) {
        let tempRange;
        if ([12, 1, 2].includes(month)) tempRange = [-30, 0];
        else if ([3, 4, 5].includes(month)) tempRange = [-5, 15];
        else if ([6, 7, 8].includes(month)) tempRange = [15, 35];
        else tempRange = [0, 15];

        if (city === "Сочи") {
          tempRange[0] += 10;
          tempRange[1] += 10;
        }

        const weatherType =
          weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
        const temperature = (
          Math.random() * (tempRange[1] - tempRange[0]) +
          tempRange[0]
        ).toFixed(1);

        const docText = `${dateStr}: ${city}, ${temperature}°C, ${weatherType}`;

        const output = await extractor(docText, {
          pooling: "mean",
          normalize: true,
        });
        const vector = Array.from(output.data);

        points.push({
          id: idCounter++,
          vector: vector,
          payload: {
            text: docText,
            city: city,
            date: dateStr,
            temperature: parseFloat(temperature),
            weather_type: weatherType,
          },
        });

        if (points.length >= 100) {
          await qdrant.upsert(collectionName, { wait: false, points: points });
          console.log(`📡 Загружено ${idCounter - 1} записей...`);
          points = [];
        }
      }
    }

    if (points.length > 0) {
      await qdrant.upsert(collectionName, { wait: true, points: points });
    }

    console.log(`✅ База данных готова! Всего записей: ${idCounter - 1}`);
  } catch (error) {
    console.error("❌ Ошибка инициализации:", error);
  }
}

setup();
