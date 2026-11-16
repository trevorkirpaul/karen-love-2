import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = join(process.cwd(), "dist");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const VIEWPORTS = [
  { name: "mobile-se", width: 375, height: 812 },
  { name: "mobile-standard", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
];

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ].filter(Boolean);

  return candidates.find((p) => existsSync(p));
}

function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const reqPath = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
        const safePath = normalize(reqPath).replace(/^(\.\.[/\\])+/, "");
        let filePath = join(rootDir, safePath === "/" ? "index.html" : safePath);

        const info = await stat(filePath).catch(() => null);
        if (info?.isDirectory()) {
          filePath = join(filePath, "index.html");
        }

        const content = await readFile(filePath);
        const ext = extname(filePath).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream" });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function main() {
  if (!existsSync(join(DIST_DIR, "index.html"))) {
    console.error("dist/index.html not found. Run `npm run build` first.");
    process.exit(1);
  }

  const { server, url } = await startStaticServer(DIST_DIR);
  const executablePath = findBrowserExecutable();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });

  const failures = [];

  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();

      const pageErrors = [];
      const consoleErrors = [];
      page.on("pageerror", (err) => pageErrors.push(err.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.goto(url, { waitUntil: "networkidle" });

      const metrics = await page.evaluate(() => {
        const docEl = document.documentElement;
        const innerWidth = window.innerWidth;
        const scrollWidth = docEl.scrollWidth;
        const clientWidth = docEl.clientWidth;

        const overflowing = [];
        for (const el of document.querySelectorAll("body *")) {
          const style = getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (rect.right > innerWidth + 1 || rect.left < -1) {
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : "";
            const cls =
              typeof el.className === "string" && el.className.trim()
                ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
                : "";
            overflowing.push({
              selector: `${tag}${id}${cls}`,
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            });
          }
        }

        const brokenImages = [];
        for (const img of document.querySelectorAll("img")) {
          const style = getComputedStyle(img);
          if (style.display === "none" || style.visibility === "hidden") continue;
          if (!img.complete || img.naturalWidth === 0) {
            brokenImages.push(img.getAttribute("src") ?? "(no src)");
          }
        }

        const topNavDirections = document.querySelector('nav a[href*="google.com/maps"], nav a[href*="maps"]');
        const topNavDirectionsVisible = topNavDirections ? getComputedStyle(topNavDirections).display !== "none" : false;

        const mobileBanner = document.querySelector('aside[aria-label="Practice location and directions"]');
        const mobileBannerVisible = mobileBanner ? getComputedStyle(mobileBanner).display !== "none" : false;

        return {
          innerWidth,
          scrollWidth,
          clientWidth,
          overflowing: overflowing.slice(0, 10),
          brokenImages,
          topNavDirectionsVisible,
          mobileBannerVisible,
        };
      });

      if (vp.width < 1024) {
        if (metrics.topNavDirectionsVisible) {
          failures.push(
            `[${vp.name} ${vp.width}x${vp.height}] Top navigation bar should not show Directions button on mobile viewports`,
          );
        }
        if (!metrics.mobileBannerVisible) {
          failures.push(
            `[${vp.name} ${vp.width}x${vp.height}] Mobile directions banner should be visible below top nav`,
          );
        }
      } else {
        if (!metrics.topNavDirectionsVisible) {
          failures.push(
            `[${vp.name} ${vp.width}x${vp.height}] Top navigation bar should show Directions button on desktop viewports`,
          );
        }
        if (metrics.mobileBannerVisible) {
          failures.push(
            `[${vp.name} ${vp.width}x${vp.height}] Mobile directions banner should be hidden on desktop viewports`,
          );
        }
      }

      if (metrics.scrollWidth > metrics.clientWidth) {
        failures.push(
          `[${vp.name} ${vp.width}x${vp.height}] Horizontal overflow detected: scrollWidth=${metrics.scrollWidth} > clientWidth=${metrics.clientWidth}. Overflowing elements: ${JSON.stringify(metrics.overflowing)}`,
        );
      }
      if (metrics.brokenImages.length > 0) {
        failures.push(
          `[${vp.name} ${vp.width}x${vp.height}] Broken images: ${metrics.brokenImages.join(", ")}`,
        );
      }
      if (pageErrors.length > 0) {
        failures.push(`[${vp.name} ${vp.width}x${vp.height}] Page errors: ${pageErrors.join("; ")}`);
      }
      if (consoleErrors.length > 0) {
        failures.push(
          `[${vp.name} ${vp.width}x${vp.height}] Console errors: ${consoleErrors.join("; ")}`,
        );
      }

      console.info(
        `[visual-check] ${vp.name} (${vp.width}x${vp.height}): scrollWidth=${metrics.scrollWidth}, clientWidth=${metrics.clientWidth}, brokenImages=${metrics.brokenImages.length}`,
      );
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length > 0) {
    console.error("\nVisual layout check failed:");
    for (const f of failures) console.error(` - ${f}`);
    process.exit(1);
  }

  console.info("All visual layout checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
