import axios from "axios";

export interface ChatResponse {
  text: string;
  error?: string;
}

export enum ModelType {
  GigaChat = "GigaChat",
  YandexAi = "YandexAi",
}

export class ChatApiService {
  private config = {
    [ModelType.YandexAi]: {
      url: "https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
      catalogId: "ВАШ_FOLDER_ID",
      token: "ВАШ_IAM_TOKEN",
    },
  };

  async regenToken() {
    try {
      const response = await axios.get("/api/giga-auth");
      return response.data;
    } catch (error) {
      console.error(error);
    }
  }

  async sendMessage(model: ModelType, message: string): Promise<ChatResponse> {
    try {
      if (model === ModelType.GigaChat) {
        const { data } = await axios.post("/api/chat", { message });
        return {
          text: data.text,
          error: data.error,
        };
      } else {
        const { data } = await axios.post("/api/yandex", { message });
        return {
          text: data.text,
          error: data.error,
        };
        // return await this.sendToYandex(message);
      }
    } catch (e) {
      return {
        text: "",
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }
  }

  private async sendToYandex(message: string): Promise<ChatResponse> {
    const { url, token, catalogId } = this.config[ModelType.YandexAi];

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-folder-id": catalogId,
      },
      body: JSON.stringify({
        modelUri: `gpt://${catalogId}/yandexgpt-lite`,
        completionOptions: { stream: false, temperature: 0.6, maxTokens: 2000 },
        messages: [{ role: "user", text: message }],
      }),
    });

    if (!response.ok) throw new Error(`Yandex HTTP Error: ${response.status}`);

    const data = await response.json();
    return {
      text:
        data.result?.alternatives?.[0]?.message?.text ||
        "Yandex empty response",
    };
  }
}

export const apiService = new ChatApiService();
