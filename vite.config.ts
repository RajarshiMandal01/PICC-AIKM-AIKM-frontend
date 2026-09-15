import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load environment variables from .env files
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: env.VITE_BASE_URL || '/', // Set the base URL for the application
    plugins: [react(), tailwindcss()],
    server: {
      port: 3007,
    },
    define: {
      "import.meta.env": JSON.stringify(env), // Ensure variables are injected
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'), // now @ = /src
      },
    }
  };
});
