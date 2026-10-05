import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto(process.argv[2], { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
console.log(await p.evaluate(new Function(process.argv[3])));
await b.close();
