import { z } from "zod";

export const settingsSchema = z.object({
  meosHost: z.string().default("http://localhost:8080"),
  controls: z.array(z.number()).default([200]),
  gridWidth: z.number().default(4),
  gridHeight: z.number().default(4),
  margin: z.number().default(10),
  gap: z.number().default(10),
  borderWidth: z.number().default(5),
  borderRadius: z.number().default(5),
  bibFontSize: z.string().default("150pt"),
  legFontSize: z.string().default("36pt"),
  fontFamily: z.string().default("Arial,sans-serif"),
  fontWeight: z.string().default("normal"),
  bibTextColor: z.string().array().default(["black", "red", "black"]),
  bgColor: z.string().array().default(["white", "white", "yellow"]),
});

export const punchSchema = z.object({
  id: z.string(),
  bibNumber: z.string(),
  leg: z.number(),
  legRunner: z.number(),
  punchTime: z.string().datetime(),
  control: z.string(),
  runnerId: z.string(),
  runnerName: z.string(),
});

export const punchEventSchema = z.object({
  type: z.literal("punch"),
  data: punchSchema,
});

export const punchesEventSchema = z.object({
  type: z.literal("punches"),
  data: z.array(punchSchema),
});

export const settingsEventSchema = z.object({
  type: z.literal("settings"),
  data: settingsSchema,
});

export const eventSchema = z.union([
  punchEventSchema,
  punchesEventSchema,
  settingsEventSchema,
]);
