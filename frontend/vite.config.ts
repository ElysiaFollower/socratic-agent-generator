import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0", // 允许外网访问
    port: 5173,
    proxy: {
      //当前端发出以/api开头的请求时，会代理到http://localhost:8000
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        timeout: 600000, // 10 minutes
        proxyTimeout: 600000, // 10 minutes
      },
    },
  },
});
