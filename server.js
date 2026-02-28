const express = require("express");
const path = require("path");
const { Agent } = require("https");
const GigaChat = require("gigachat").default;
require("dotenv").config({ path: ".env.local" });

// import express from "express";
// import path from "path";
// import { Agent } from "https";
// import GigaChat from "gigachat";
// import dotenv from "dotenv";
// dotenv.config({ path: ".env.local" });

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, "dist")));

const httpsAgent = new Agent({ rejectUnauthorized: false });
const client = new GigaChat({
  credentials: process.env.GIGACHAT_AUTH_KEY,
  httpsAgent: httpsAgent,
  scope: "GIGACHAT_API_PERS",
});

const functions = [
  {
    name: "get_weather",
    description: "Получает текущую погоду в указанном городе",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "Город, например, Москва" },
      },
      required: ["location"],
    },
  },
];

async function fetchWeather(city) {
  try {
    const url = `http://api.weatherstack.com/current?access_key=${
      process.env.WEATHER_API_KEY
    }&query=${encodeURIComponent(city)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) return { error: "Город не найден или ошибка API" };

    return {
      city: data.location.name,
      temperature: data.current.temperature + "°C",
      description: data.current.weather_descriptions[0],
      wind: data.current.wind_speed + " км/ч",
    };
  } catch (e) {
    console.error(e);
    return { error: "Ошибка подключения к сервису погоды" };
  }
}

app.post("/api/chat", async (req, res) => {
  try {
    const response = await client.chat({
      messages: [{ role: "user", content: req.body.message }],
      functions: functions,
      function_call: "auto",
    });

    const message = response.choices[0].message;

    if (message.function_call) {
      const args =
        typeof message.function_call.arguments === "string"
          ? JSON.parse(message.function_call.arguments)
          : message.function_call.arguments;

      const { location } = args;
      const weatherData = await fetchWeather(location);

      const finalResponse = await client.chat({
        messages: [
          { role: "user", content: req.body.message },
          message,
          {
            role: "function",
            name: "get_weather",
            content: JSON.stringify(weatherData),
          },
        ],
      });

      return res.json({ text: finalResponse.choices[0].message.content });
    }
    res.json({ text: message.content });
  } catch (error) {
    console.error(error);
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

    if (!response.ok) {
      console.log("Детальная ошибка Yandex:", JSON.stringify(data, null, 2));
      throw new Error(data.message || "Ошибка Yandex API");
    }

    res.json({
      text: data.result.alternatives[0].message.text,
    });
  } catch (error) {
    console.error("Yandex Error:", error);
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
