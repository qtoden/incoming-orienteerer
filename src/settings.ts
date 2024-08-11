import path from "path";
import fs from "fs/promises";
import { z } from "zod";
import { settingsSchema } from "../schema.ts";

const settingsPath = path.resolve(import.meta.dirname, "../settings.json");
let settings: z.infer<typeof settingsSchema>;

try {
  const settingsData = await fs.readFile(settingsPath, "utf-8");

  const unvalidatedSettings = JSON.parse(settingsData);

  settings = settingsSchema.parse(unvalidatedSettings);
} catch (e) {
  if (e.code === "ENOENT") {
    console.error(`Settings file not found at ${settingsPath}`);
    process.exit(1);
  }

  if (e instanceof SyntaxError) {
    console.error(`Settings file is not valid JSON: ${e.message}`);
    process.exit(1);
  }

  if (e instanceof z.ZodError) {
    console.error(`Settings file is not valid: ${JSON.stringify(e.issues, null, 2)}`);
    process.exit(1);
  }
}

export { settings };
