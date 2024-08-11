import { mkdirp } from "mkdirp";
import xml2js from "xml2js";

import fs from "fs";
import path from "path";
import { meosXmlSchema, punchSchema } from "../schema.ts";
import { z } from "zod";
import { settings } from "./settings.ts";

const parser = new xml2js.Parser();

interface Competitor {
  card?: string;
  name?: string;
}

interface Team {
  id: string;
  bibNumber?: string;
  runners: string[][]; // [leg][competitorIds]
}

type Punch = z.infer<typeof punchSchema>;

export const createMeosFetcher = async (host: string) => {
  let lastXml: string;

  const teams = new Map<string, Team>();
  const competitors = new Map<string, Competitor>();
  let nextdifference: string = "zero";

  const allPunches = new Map<string, Punch>();

  async function updateMeOSData(onNewPunchCallback?: (punch: Punch) => void) {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    let res: Response;
    try {
      res = await fetch(`http://${host}/meos?difference=${nextdifference}`);
    } catch (err) {
      console.error(
        `Error while fetching MeOS data, nextdifference=${nextdifference}, restarting with nextdifference=zero`,
      );
      console.error(err);
      teams.clear();
      competitors.clear();
      nextdifference = "zero";
      return;
    }
    const xml = await res.text();

    if (xml === lastXml) {
      return;
    }

    lastXml = xml;

    logXml(xml, nextdifference);

    let result: unknown;
    try {
      result = await parser.parseStringPromise(xml);
    } catch (err) {
      console.warn("Failed to parse XML, restarting with nextdifference=zero");
      teams.clear();
      competitors.clear();
      nextdifference = "zero";
      return;
    }

    let parsed: z.infer<typeof meosXmlSchema>;

    try {
      parsed = meosXmlSchema.parse(result);
    } catch (err) {
      console.warn(
        "Failed to validate XML, restarting with nextdifference=zero",
      );
      console.dir(err, { depth: null });
      teams.clear();
      competitors.clear();
      nextdifference = "zero";
      return;
    }

    let data =
      "MOPComplete" in parsed
        ? parsed.MOPComplete
        : "MOPDiff" in parsed
          ? parsed.MOPDiff
          : undefined;

    if (!data) {
      return;
    }

    nextdifference = data.$.nextdifference;

    if (data.tm) {
      for (const tm of data.tm) {
        if (tm.$.delete) {
          const team = teams.get(tm.$.id);
          if (team) {
            teams.delete(tm.$.id);
            console.log(`Deleted team ${team.id}/${team.bibNumber}`);
          }
          continue;
        }

        const runners = (tm?.r?.at(0) || "")
          .split(";")
          .map((leg) => leg.split(","));

        const team = {
          id: tm.$.id,
          bibNumber: tm?.base?.at(0)?.$.bib,
          runners,
        };
        teams.set(tm.$.id, team);
        console.log(`Updated team ${team.id}/${team.bibNumber || "-"}`);
      }
    }

    if (data.cmp) {
      for (const cmp of data.cmp) {
        if (cmp.$.delete) {
          const competitor = competitors.get(cmp.$.id);
          if (competitor) {
            competitors.delete(cmp.$.id);
            console.log(
              `Deleted competitor ${competitor.card}/${competitor.name}`,
            );
          }
          continue;
        }

        let currentCard: string | undefined;
        if (competitors.has(cmp.$.id)) {
          currentCard = competitors.get(cmp.$.id)?.card;
        }

        const competitor = {
          card: typeof cmp.$.card === "string" ? cmp.$.card : currentCard,
          name: cmp.base?.at(0)?._,
        };

        competitors.set(cmp.$.id, competitor);

        console.log(`Updated competitor ${competitor.card}/${competitor.name}`);

        const team = [...teams.values()].find((team) => {
          return team.runners.some((leg) => leg.includes(cmp.$.id));
        });

        if (!team) {
          console.log("  Not part of any team");
          continue;
        }

        if (!team.bibNumber) {
          console.warn("  Part of team but missing bib number");
          continue;
        }

        const stStr = cmp?.base?.at(0)?.$.st;
        if (typeof stStr !== "string") {
          continue;
        }

        const st = parseInt(stStr);

        if (!cmp.radio) {
          continue;
        }

        const visits = cmp.radio[0].split(";");

        for (const visit of visits) {
          const parts = visit.split(",");
          const ctrl = parts[0];

          if (!settings.controls.includes(ctrl)) {
            continue
          }

          const rt = parseInt(parts[1]);

          const punchTimeDeciSeconds = st + rt;
          const punchTimeMs = punchTimeDeciSeconds * 100;

          const leg = team.runners.findIndex((leg) => leg.includes(cmp.$.id));
          const legRunner = team.runners[leg].indexOf(cmp.$.id);
          const punchId = `${ctrl}:${leg}:${legRunner}:${team.bibNumber}:${
            competitor.card || "-"
          }`;

          if (!allPunches.has(punchId)) {
            const newPunch = {
              id: punchId,
              control: ctrl,
              bibNumber: team.bibNumber,
              punchTime: punchTimeMs,
              leg,
              legRunner,
              runnerId: cmp.$.id,
              runnerName: cmp.base?.at(0)?._,
            };

            console.log(`  New punch: ${newPunch.id}`);

            allPunches.set(punchId, newPunch);

            onNewPunchCallback?.(newPunch);
          }
        }
      }
    }
  }

  function startPoll(onNewPunchCallback: (punch: Punch) => void) {
    updateMeOSData(onNewPunchCallback);
    setInterval(() => {
      updateMeOSData(onNewPunchCallback);
    }, 5000);
  }

  // Initial fetch, to get "old" punches.
  await updateMeOSData();

  return {
    getAllPunches: () => [...allPunches.values()],
    startPoll,
  };
};

function getTimestampString() {
  return new Date()
    .toISOString()
    .replace(/T/, "--") // replace T with a space
    .replace(/\..+/, "")
    .replace(/:/g, "-");
}

async function logXml(xml: string, nextdifference: string) {
  const logPath = path.resolve(import.meta.dirname, "../logs");
  await mkdirp(logPath);
  fs.writeFile(
    path.resolve(logPath, `meos-${getTimestampString()}-${nextdifference}.xml`),
    xml,
    (err) => {
      if (err) {
        console.error("Could not log XML result", err);
      }
    },
  );
}
