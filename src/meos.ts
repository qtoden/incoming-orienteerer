import { mkdirp } from "mkdirp";
import xml2js from "xml2js";

import fs from "fs";
import path from "path";

const parser = new xml2js.Parser();

interface Competitor {
  card: string;
  name: string;
}

interface Team {
  id: string;
  bibNumber: string;
  runners: string[][]; // [leg][competitorIds]
}

interface MeOSRadioPunch {
  id: string;

  bibNumber: string;
  leg: number;
  legRunner: number;
  punchTime: Date;

  control: string;
  runnerId: string;
  runnerName: string;
}

interface CommonXml {
  /** competition */
  competition: [
    {
      /** name */
      _: string;
      $: {
        date: string; // YYYY-MM-dd
        organizer: string;
        homepage: string;
      };
    },
  ];
  /** radio controls */
  ctrl: {
    /** name */
    _: string;
    $: {
      id: string;
    };
  }[];
  /** classes */
  cls: {
    /** name */
    _: string;
    $: {
      id: string;
      ord: string;
      /** comma separated radio control ids */
      radio: string;
    };
  }[];
  /** organizations (clubs) */
  org: {
    /** name */
    _: string;
    $: {
      id: string;
      nat: string;
    };
  }[];
  /** teams */
  tm: {
    $: {
      id: string;
      delete?: boolean;
    };
    base: [
      {
        /** team name */
        _: string;
        $: {
          org?: string;
          cls?: string;
          stat?: string;
          st?: string;
          rt?: string;
          bib?: string;
        };
      },
    ];
    /* semi-colon separated runner ids */
    r: string[];
  }[];
  cmp: {
    $: {
      id: string;
      card?: string;
      delete?: boolean;
    };
    base?: [
      {
        /** name */
        _: string;
        $: {
          /** organization id */
          org: string;
          /** class id */
          cls: string;
          /** status numbers 0-99 */
          stat: string;
          /** start time, tenth of seconds since 00:00:00 */
          st: string;
          /** running time, tenth of seconds since st */
          rt: string;
        };
      },
    ];
    /**
     * radio visits:
     * ctrl,rt;ctrl,rt;ctrl,rt
     */
    radio: [string];
    /* ? is this for multi-day events? */
    input: [
      {
        it: string;
        tstst: string;
      },
    ];
  }[];
}

interface MOPComplete extends CommonXml {
  $: { xmlns: "http://www.melin.nu/mop"; nextdifference: string };
}

interface ParsedMOPComplete {
  MOPComplete: MOPComplete;
}

interface MOPDiff extends CommonXml {
  $: { nextdifference: string };
}

interface ParsedMOPDiff {
  MOPDiff: MOPDiff;
}

export const createMeosFetcher = async (host: string) => {
  let lastXml: string;

  const teams = new Map<string, Team>();
  const competitors = new Map<string, Competitor>();
  let nextdifference: string = "zero";
  //let competitionDate: Date | null = null;

  const radioPunches = new Map<string, MeOSRadioPunch>();

  async function updateMeOSData(
    onNewPunchCallback?: (punch: MeOSRadioPunch) => void,
  ) {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    let res;
    try {
      // res = await fetchMock();
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

    let result: ParsedMOPComplete | ParsedMOPDiff;
    try {
      result = await parser.parseStringPromise(xml);
    } catch (err) {
      console.warn("Failed to parse XML, restarting with nextdifference=zero");
      teams.clear();
      competitors.clear();
      nextdifference = "zero";
      return;
    }

    let data: ParsedMOPComplete["MOPComplete"] | ParsedMOPDiff["MOPDiff"];

    if ("MOPComplete" in result) {
      data = result.MOPComplete;
    } else if ("MOPDiff" in result) {
      data = result.MOPDiff;
    }

    nextdifference = data.$.nextdifference;

    if (!data) {
      return;
    }

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

        const runners = (tm?.r[0] || "")
          .split(";")
          .map((leg) => leg.split(","));

        const team = {
          id: tm.$.id,
          bibNumber: tm.base[0].$.bib,
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

        let currentCard;
        if (competitors.has(cmp.$.id)) {
          currentCard = competitors.get(cmp.$.id)?.card;
        }

        const competitor = {
          card: typeof cmp.$.card === "string" ? cmp.$.card : currentCard,
          name: cmp.base[0]._,
        };

        competitors.set(cmp.$.id, competitor);

        console.log(`Updated competitor ${competitor.card}/${competitor.name}`);

        const team = [...teams.values()].find((team) => {
          return team.runners.some((leg) => leg.includes(cmp.$.id));
        });

        if (!team?.bibNumber) {
          console.warn("  Part of team but missing bib number");
          continue;
        }

        const st = parseInt(cmp.base[0].$.st);

        if (!cmp.radio) {
          continue;
        }

        const visits = cmp.radio[0].split(";");

        for (const visit of visits) {
          const parts = visit.split(",");
          const ctrl = parts[0];
          const rt = parseInt(parts[1]);

          const punchTimeDeciSeconds = st + rt;
          const punchTimeMs = punchTimeDeciSeconds * 100;

          const punchTime = new Date(midnight);
          punchTime.setMilliseconds(punchTime.getMilliseconds() + punchTimeMs);

          const leg = team.runners.findIndex((leg) => leg.includes(cmp.$.id));
          const legRunner = team.runners[leg].indexOf(cmp.$.id);
          const punchId = `${ctrl}:${leg}:${legRunner}:${team.bibNumber}:${
            competitor.card || "-"
          }`;

          if (!radioPunches.has(punchId)) {
            const newPunch = {
              id: punchId,
              control: ctrl,
              bibNumber: team.bibNumber,
              punchTime,
              leg,
              legRunner,
              runnerId: cmp.$.id,
              runnerName: cmp.base[0]._,
            };

            console.log(`  New punch: ${newPunch.id}`);

            radioPunches.set(punchId, newPunch);

            onNewPunchCallback?.(newPunch);
          }
        }
      }
    }
  }

  function startPoll(onNewPunchCallback: (punch: MeOSRadioPunch) => void) {
    updateMeOSData(onNewPunchCallback);
    setInterval(() => {
      updateMeOSData(onNewPunchCallback);
    }, 5000);
  }

  // Initial fetch, to get "old" punches.
  await updateMeOSData();

  return {
    getAllPunches: () => [...radioPunches.values()],
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
