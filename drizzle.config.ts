import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle/migrations",
  schema: "./worker/db/schema.ts",
  dialect: "sqlite",
});
