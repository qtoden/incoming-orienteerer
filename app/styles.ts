import { z } from "zod";
import { settingsSchema } from "../schema";

export function applyStyles(appContainer: HTMLElement, settings: z.infer<typeof settingsSchema>) {
  const allBibs = document.querySelectorAll("[data-bib]");

  appContainer.style.setProperty(
    "--bib-border-radius",
    `${settings.borderRadius}px`,
  );

  appContainer.style.setProperty(
    "--bib-border-width",
    `${settings.borderWidth}px`,
  );

  appContainer.style.setProperty("--bib-font-size", settings.bibFontSize);

  appContainer.style.setProperty("--bib-font-weight", settings.fontWeight);

  appContainer.style.setProperty("--bib-font-family", settings.fontFamily);

  appContainer.style.setProperty("--bib-font-size", settings.bibFontSize);

  appContainer.style.setProperty(
    "--bib-leg-font-size",
    settings.legFontSize,
  );

  appContainer.style.setProperty(
    "--bib-leg-font-weight",
    settings.fontWeight,
  );

  appContainer.style.setProperty(
    "--bib-leg-font-family",
    settings.fontFamily,
  );

  const containerWidth = appContainer.clientWidth;
  const containerHeight = appContainer.clientHeight;

  for (let i = 0; i < allBibs.length; i++) {
    const bib = allBibs[i];
    if (!(bib instanceof HTMLElement)) {
      continue;
    }

    const x = i % settings.gridWidth;
    const y = Math.floor(i / settings.gridWidth);

    const totalSpaceX =
      2 * settings.margin + (settings.gridWidth - 1) * settings.gap;

    const totalSpaceY =
      2 * settings.margin + (settings.gridHeight - 1) * settings.gap;

    const itemWidth = (containerWidth - totalSpaceX) / settings.gridWidth;
    const itemHeight = (containerHeight - totalSpaceY) / settings.gridHeight;

    const xPx = settings.margin + x * settings.gap + x * itemWidth;
    const yPx = settings.margin + y * settings.gap + y * itemHeight;

    const leg = parseInt(bib.getAttribute("data-leg") || "0", 10);

    bib.style.transform = `translate(${xPx}px, ${yPx}px)`;
    bib.style.width = `${itemWidth}px`;
    bib.style.height = `${itemHeight}px`;
    bib.style.borderStyle = "solid";
    bib.style.borderColor = "black";
    bib.style.color = settings.bibTextColor[leg % settings.bibTextColor.length];
    bib.style.backgroundColor = settings.bgColor[leg % settings.bgColor.length];
  }
}
