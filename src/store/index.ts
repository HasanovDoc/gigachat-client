// store/index.ts
import Vue from "vue";
import Vuex from "vuex";
import { ModelType } from "@/services/ApiService";

Vue.use(Vuex);

const SAVED_THEME = localStorage.getItem("user-theme") as
  | "light"
  | "dark"
  | null;

export default new Vuex.Store({
  state: {
    messages: [] as Array<{ role: "user" | "ai"; text: string }>,
    currentModel: ModelType.GigaChat as ModelType,
    theme: SAVED_THEME || "light",
  },
  mutations: {
    ADD_MESSAGE(state, payload) {
      state.messages.push(payload);
    },
    SET_MODEL(state, model: ModelType) {
      state.currentModel = model;
    },
    TOGGLE_THEME(state) {
      state.theme = state.theme === "light" ? "dark" : "light";
      localStorage.setItem("user-theme", state.theme);
    },
  },
});
