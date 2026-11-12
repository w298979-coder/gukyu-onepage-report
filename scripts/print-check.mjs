// 실제 인쇄 미리보기 점검: 설치된 크롬을 화면 없이 띄워 인쇄용 CSS(@media print)와 실제 PDF 인쇄를 그대로 돌려
// ① A4 가로 인쇄 영역 그림(PNG), ② 인쇄한 PDF의 쪽수(한 장이어야 함)를 만든다.
// 실행: node scripts/print-check.mjs <출력 폴더> <주소1> [주소2 ...]
//   예: node scripts/print-check.mjs C:/temp/print "http://localhost:3000/?q=가양동%20177-5"
// 개발 서버(npm run dev)가 켜져 있어야 하고, AI 검토가 끝난 모습을 찍기 위해 결과가 나올 때까지 최대 40초 기다린다.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [outDir, ...urls] = process.argv.slice(2);
if (!outDir || urls.length === 0) {
  console.error("사용법: node scripts/print-check.mjs <출력 폴더> <주소1> [주소2 ...]");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((p) => fs.existsSync(p));
if (!CHROME) {
  console.error("크롬 또는 엣지를 찾지 못했습니다.");
  process.exit(1);
}

const PORT = 9333;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "print-check-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = tabs.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* 아직 안 떴다 */
    }
    await sleep(250);
  }
  throw new Error("크롬에 연결하지 못했습니다.");
}

try {
  const ws = new WebSocket(await connect());
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const myId = ++id;
      pending.set(myId, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
      ws.send(JSON.stringify({ id: myId, method, params }));
    });
  const evalJs = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result.value;

  await send("Page.enable");
  for (const [n, url] of urls.entries()) {
    // 화면용 크기로 먼저 열어 AI 검토가 끝날 때까지 기다린다
    await send("Emulation.setEmulatedMedia", { media: "screen" });
    await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url });
    await sleep(1500);
    for (let i = 0; i < 40; i++) {
      const ready = await evalJs(`(() => { const t = document.body.innerText; return t.length > 200 && !/검토하는 중|검토 중|AI 검토 중/.test(t); })()`);
      if (ready) break;
      await sleep(1000);
    }
    await sleep(500);
    // 인쇄 미리보기: 인쇄용 CSS를 적용하고 A4 가로 인쇄 영역(여백 8mm 제외, 96dpi 기준 1062×733px)으로 그림을 찍는다
    await send("Emulation.setEmulatedMedia", { media: "print" });
    await send("Emulation.setDeviceMetricsOverride", { width: 1062, height: 733, deviceScaleFactor: 2, mobile: false });
    await sleep(500);
    const shot = await send("Page.captureScreenshot", { format: "png" });
    const png = path.join(outDir, `preview-${n + 1}.png`);
    fs.writeFileSync(png, Buffer.from(shot.data, "base64"));
    // 실제 PDF 인쇄: 쪽수와 용지 크기
    const pdf = await send("Page.printToPDF", { preferCSSPageSize: true, printBackground: true });
    const buf = Buffer.from(pdf.data, "base64");
    const pdfPath = path.join(outDir, `print-${n + 1}.pdf`);
    fs.writeFileSync(pdfPath, buf);
    const text = buf.toString("latin1");
    const pages = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    const box = text.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
    const overflow = await evalJs(`(() => { const secs=[...document.querySelectorAll('section')].filter(s=>s.querySelector('h2')&&!s.closest('dialog')); return secs.filter(s=>{const b=s.children[1];return b&&b.scrollHeight>b.clientHeight+1}).length; })()`);
    console.log(`${pages === 1 ? "통과" : "실패"} | ${url} | PDF ${pages}쪽 ${box ? `${Math.round(Number(box[1]))}×${Math.round(Number(box[2]))}pt` : ""} | 잘린 카드 ${overflow}개 | ${png}`);
  }
  ws.close();
} finally {
  chrome.kill();
  await sleep(300);
  fs.rmSync(profile, { recursive: true, force: true });
}
