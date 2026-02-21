<template>
  <div :class="['chat-layout', theme]">
    <header class="chat-header glass-effect">
      <select v-model="activeModel" class="model-select glass-effect">
        <option value="GigaChat">GigaChat</option>
        <option value="YandexAi">YandexAi</option>
      </select>

      <div class="header-right">
        <button class="regen-token glass-effect" @click="regenToken">
          Сделать новый токен
        </button>
        <button class="theme-toggle-btn glass-effect" @click="toggleTheme">
          {{ theme === "light" ? "🌙" : "☀️" }}
        </button>
      </div>
    </header>

    <main class="message-area" ref="scrollContainer">
      <div
        v-for="(msg, i) in messages"
        :key="i"
        :class="['message-bubble-wrapper', msg.role]"
      >
        <div class="message-bubble glass-effect">{{ msg.text }}</div>
      </div>
      <div v-if="pending" class="message-bubble-wrapper ai typing">
        <div class="message-bubble glass-effect">Печатает...</div>
      </div>
    </main>

    <footer class="input-composer glass-effect">
      <input
        v-model="query"
        @keyup.enter="handleSend"
        type="text"
        placeholder="Введите ваше сообщение..."
        class="text-input glass-effect"
      />
      <button
        :disabled="pending"
        @click="handleSend"
        class="send-btn glass-effect"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </footer>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { apiService, ModelType } from "@/services/ApiService";
// import { ENV } from "@/config";

export default Vue.extend({
  data() {
    return {
      query: "",
      pending: false,
    };
  },
  computed: {
    messages() {
      return this.$store.state.messages;
    },
    theme() {
      return this.$store.state.theme;
    },
    activeModel: {
      get(): ModelType {
        return this.$store.state.currentModel;
      },
      set(val: ModelType) {
        this.$store.commit("SET_MODEL", val);
      },
    },
  },
  methods: {
    toggleTheme() {
      this.$store.commit("TOGGLE_THEME");
    },
    async regenToken() {
      await apiService.regenToken(
        ""
      );
    },
    async handleSend() {
      if (!this.query.trim() || this.pending) return;

      const text = this.query;
      this.query = "";
      this.$store.commit("ADD_MESSAGE", { role: "user", text });

      this.pending = true;
      const res = await apiService.sendMessage(this.activeModel, text);
      this.pending = false;

      this.$store.commit("ADD_MESSAGE", {
        role: "ai",
        text: res.error || res.text,
      });

      this.$nextTick(() => {
        const el = this.$refs.scrollContainer as HTMLElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },
  },
  mounted() {
    const el = this.$refs.scrollContainer as HTMLElement;
    if (el) el.scrollTop = el.scrollHeight;
  },
});
</script>

<style lang="scss" scoped>
.chat-layout {
  --bg-color-light: #f0f2f5;
  --bg-color-dark: #1a1a2e;
  --text-color-light: #2c3e50;
  --text-color-dark: #ecf0f1;
  --glass-bg-light: rgba(255, 255, 255, 0.4);
  --glass-bg-dark: rgba(0, 0, 0, 0.3);
  --glass-border-light: rgba(255, 255, 255, 0.7);
  --glass-border-dark: rgba(255, 255, 255, 0.1);
  --shadow-light: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-dark: 0 4px 6px rgba(0, 0, 0, 0.3);
  --user-bubble-bg-light: #a8dadc;
  --user-bubble-bg-dark: #457b9d;
  --ai-bubble-bg-light: #e0e0e0;
  --ai-bubble-bg-dark: #6a6a8a;
  --input-focus-border-light: #48cae4;
  --input-focus-border-dark: #90e0ef;

  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-color-light);
  color: var(--text-color-light);
  transition: background 0.4s ease, color 0.4s ease;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;

  &.dark {
    background: var(--bg-color-dark);
    color: var(--text-color-dark);
  }
}

.glass-effect {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border-light);
  box-shadow: var(--shadow-light);
  border-radius: 12px;
  transition: all 0.3s ease;

  .chat-layout.dark & {
    background: var(--glass-bg-dark);
    border: 1px solid var(--glass-border-dark);
    box-shadow: var(--shadow-dark);
  }
}

.chat-header {
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 10px;
  min-height: 60px;
  z-index: 10;
}

.model-select,
.theme-toggle-btn {
  padding: 8px 15px;
  cursor: pointer;
  appearance: none;
  font-size: 1rem;
  color: inherit;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-light);
    .chat-layout.dark & {
      box-shadow: var(--shadow-dark);
    }
  }
}

.model-select {
  min-width: 150px;
}

.header-right {
  display: flex;
  gap: 20px;
}

.regen-token {
  padding: 8px 15px;
  color: inherit;
}

.message-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.message-bubble-wrapper {
  display: flex;

  &.user {
    justify-content: flex-end;
  }

  .message-bubble {
    max-width: 75%;
    padding: 14px 18px;
    font-size: 1rem;
    line-height: 1.6;
  }

  &.user .message-bubble {
    background: var(--user-bubble-bg-light);
    color: var(--text-color-light);
    border-top-right-radius: 4px;
    .chat-layout.dark & {
      background: var(--user-bubble-bg-dark);
      color: var(--text-color-dark);
    }
  }

  &.ai .message-bubble {
    background: var(--ai-bubble-bg-light);
    color: var(--text-color-light);
    border-top-left-radius: 4px;
    .chat-layout.dark & {
      background: var(--ai-bubble-bg-dark);
      color: var(--text-color-dark);
    }
  }

  &.typing .message-bubble {
    font-style: italic;
    opacity: 0.7;
  }
}

.input-composer {
  padding: 15px 20px;
  display: flex;
  gap: 10px;
  margin: 10px;
}

.text-input {
  flex: 1;
  padding: 12px 18px;
  font-size: 1rem;
  border: none;
  outline: none;
  color: inherit;

  &:focus {
    box-shadow: 0 0 0 3px var(--input-focus-border-light);
    .chat-layout.dark & {
      box-shadow: 0 0 0 3px var(--input-focus-border-dark);
    }
  }
}

.send-btn {
  width: 50px;
  height: 50px;
  min-width: 50px;
  border: none;
  background: var(--user-bubble-bg-light);
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  font-size: 1.5rem;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  svg {
    width: 24px;
    height: 24px;
    fill: currentColor;
  }

  .chat-layout.dark & {
    background: var(--user-bubble-bg-dark);
  }
}
</style>
