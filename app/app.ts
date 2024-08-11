import { TaskQueue } from "./task-queue";
import { eventSchema, punchSchema, settingsSchema } from "../schema";
import { z } from "zod";
import { applyStyles } from "./styles";

let settings: z.infer<typeof settingsSchema> | null = null;

const appContainer = document.getElementById("app");
if (!appContainer) {
  throw new Error("No app container");
}

// Make sure our grid items are aligned when the window resizes:
const resizeObserver = new ResizeObserver(() => {
  applyStyles(appContainer, getSettings());
});
resizeObserver.observe(appContainer);

// Keep a queue of announcements, so they don't overlap, and so that we can
// make a "ding!" sound before a batch of announcement.
const announcementQueue = new TaskQueue();

async function playAudio(src: string) {
  const audioElement = new Audio(src);
  audioElement.play();
  await new Promise<void>((resolve) => {
    function done() {
      audioElement.removeEventListener("ended", done);
      resolve();
    }
    audioElement.addEventListener("ended", done);
  });
}

function getSettings() {
  if (!settings) {
    throw new Error("Expected settings to be present");
  }
  return settings;
}

function addBib(punch: z.infer<typeof punchSchema>) {
  const bibElement = document.createElement("div");
  bibElement.classList.add("bib");
  // TODO: add id or other attributes too
  bibElement.setAttribute("data-bib", punch.id);
  bibElement.setAttribute("data-leg", punch.leg.toString());

  const innerBibElement = document.createElement("div");
  innerBibElement.classList.add("bib-inner");
  bibElement.appendChild(innerBibElement);

  const bibNumberElement = document.createElement("div");
  bibNumberElement.classList.add("bib-number");
  bibNumberElement.textContent = punch.bibNumber;
  innerBibElement.appendChild(bibNumberElement);

  const legNumberElement = document.createElement("div");
  legNumberElement.classList.add("leg-number");
  legNumberElement.textContent = String(punch.leg + 1);
  innerBibElement.appendChild(legNumberElement);

  appContainer?.prepend(bibElement);

  removeSuperfluousBibs();
}

function removeSuperfluousBibs() {
  const settings = getSettings();
  const totalItems = settings.gridWidth * settings.gridHeight;
  const allBibs = document.querySelectorAll("[data-bib]");
  for (let i = totalItems; i < allBibs.length; i++) {
    allBibs[i].remove();
  }
}

function highlightBib(bibId: string) {
  const bibElement = document.querySelector(`[data-bib="${bibId}"]`);
  if (!bibElement) {
    return;
  }

  bibElement.classList.add("highlight");
  setTimeout(() => {
    bibElement.classList.remove("highlight");
  }, 1000);
}

// Listen for events from the server:
const eventSource = new EventSource("/sse");
eventSource.addEventListener("message", async (e) => {
  const data = JSON.parse(e.data);
  const event = eventSchema.parse(data);

  switch (event.type) {
    case "settings":
      // The server gives us (the client) the settings.
      settings = event.data;
      console.log(`Received settings:\n${JSON.stringify(settings, null, 2)}`);
      break;

    case "punches":
      // Received a list of _all_ punches, clear the board and re-render
      // them all. This is meant for initial loading or syncronization,
      // so no need to play audio or highlight.
      appContainer.innerHTML = "";
      for (const punch of event.data) {
        addBib(punch);
      }
      applyStyles(appContainer, getSettings());
      break;

    case "punch":
      // New punch, add to the board, play audio and highlight.
      addBib(event.data);
      applyStyles(appContainer, getSettings());

      const shouldDing = !announcementQueue.isProcessing;

      announcementQueue.addTask(async () => {
        if (shouldDing) {
          await playAudio(`ding.mp3`);
        }
        highlightBib(event.data.id);
        await playAudio(`sv/${event.data.bibNumber}.mp3`);
      });
  }
});
