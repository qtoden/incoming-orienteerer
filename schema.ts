import { z } from "zod";

export const settingsSchema = z.object({
  meosHost: z.string().default("http://localhost:8080"),
  controls: z.array(z.string()).default(["200"]),
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
  punchTime: z.number(),
  control: z.string(),
  runnerId: z.string(),
  runnerName: z.string().optional(),
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

export const meosXmlCommonSchema = z.object({
  $: z.object({
    xmlns: z.literal("http://www.melin.nu/mop"),
    nextdifference: z.string(),
  }),
  competition: z
    .object({
      _: z.string(),
      $: z.object({
        date: z.string(),
        organizer: z.string(),
        homepage: z.string(),
      }),
    })
    .array()
    .optional(),

  /* radio controls */
  ctrl: z
    .object({
      _: z.string(),
      $: z.object({
        id: z.string(),
      }),
    })
    .array()
    .optional(),

  /* classes */
  cls: z
    .object({
      /* name */
      _: z.string(),
      $: z.object({
        id: z.string(),
        ord: z.string(),
        /* comma separated radio control ids */
        radio: z.string().optional(),
      }),
    })
    .array()
    .optional(),

  /* organizations (clubs) */
  org: z
    .object({
      /* name */
      _: z.string(),
      $: z.object({
        id: z.string(),
        nat: z.string().optional(),
      }),
    })
    .array()
    .optional(),

  /* teams */
  tm: z
    .object({
      $: z.object({
        id: z.string(),
        delete: z.boolean().optional(),
      }),
      base: z
        .object({
          /* team name */
          _: z.string(),
          $: z.object({
            org: z.string().optional(),
            cls: z.string().optional(),
            stat: z.string().optional(),
            st: z.string().optional(),
            rt: z.string().optional(),
            bib: z.string().optional(),
          }),
        })
        .array()
        .optional(),
      /* semi-colon separated runner ids */
      r: z.string().array().optional(),
    })
    .array()
    .optional(),

  cmp: z
    .object({
      $: z.object({
        id: z.string(),
        card: z.string().optional(),
        delete: z.boolean().optional(),
      }),
      base: z
        .object({
          /* name */
          _: z.string(),
          $: z.object({
            /* organization id */
            org: z.string().optional(),
            /* class id */
            cls: z.string().optional(),
            /* status numbers 0-99 */
            stat: z.string().optional(),
            /* start time, tenth of seconds since 00:00:00 */
            st: z.string().optional(),
            /* running time, tenth of seconds since st */
            rt: z.string().optional(),
          }),
        })
        .array()
        .optional(),
      /*
       * radio visits:
       * ctrl,rt;ctrl,rt;ctrl,rt
       */
      radio: z.string().array().optional(),

      input: z
        .object({
          it: z.string().optional(),
          tstst: z.string().optional(),
        })
        .array()
        .optional(),
    })
    .array()
    .optional(),
});

export const meosCompleteXmlSchema = z.object({
  MOPComplete: meosXmlCommonSchema,
});

export const meosDiffXmlSchema = z.object({
  MOPDiff: meosXmlCommonSchema,
});

export const meosXmlSchema = z.union([
  meosCompleteXmlSchema,
  meosDiffXmlSchema,
]);
