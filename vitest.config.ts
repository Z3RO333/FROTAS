import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
