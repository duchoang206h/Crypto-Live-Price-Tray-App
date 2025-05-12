const { app, Tray } = require("electron");
const WebSocket = require("ws");
let ws;
let dataMap = new Map();
const symbolConfigs = require("./symbol.config.json");
const symbolMap = {};
const symbols = [];
const HEARTBEAT_TIMEOUT = 60000; // 60 seconds
let lastMessageTime = Date.now();
const retryDelay = 5000;

symbolConfigs.forEach((s) => {
  symbolMap[s.symbol] = { order: s.order, decimal: s.decimal };
  symbols.push(s.symbol + "USDT");
});

function monitorHeartbeat(tray, symbols) {
  console.log("Monitoring heartbeat");
  setInterval(() => {
    if (Date.now() - lastMessageTime < HEARTBEAT_TIMEOUT) {
      console.log("Monitoring: Healthy ✅");
      return;
    }
    console.warn("💔 No message from Binance in 60s. Reconnecting...");
    fetchLivePrices(tray, symbols);
  }, HEARTBEAT_TIMEOUT / 2); // Check more frequently than timeout
}

function fetchLivePrices(tray, symbols) {
  try {
    if (symbols.length === 0) return;
    const streams = symbols
      .map((symbol) => `${symbol.toLowerCase()}@ticker`)
      .join("/");

    if (ws) {
      ws.close(); // Clean up before reconnecting
    }

    ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streams}`);

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      // ANSI color codes
      const RED = "\x1b[31m";
      const GREEN = "\x1b[32m";
      const RESET = "\x1b[0m";

      // Get symbol, price, and percentage change
      const symbol = data.s.replace("USDT", "");
      const price = parseFloat(data.c).toFixed(symbolMap[symbol].decimal);
      const changePercent = parseFloat(data.P).toFixed(1);

      // Decide color based on change
      const color = changePercent < 0 ? RED : GREEN;
      const arrow = changePercent < 0 ? "↓" : "↑";

      // Output
      const title = `${symbol}${color}${price}${arrow}${Math.abs(
        changePercent
      )}${RESET}`;
      dataMap.set(symbol, title);

      let titles = [...dataMap];
      titles.sort((a, b) => {
        const symbolA = a[0];
        const symbolB = b[0];
        return (
          (symbolMap[symbolA].order || 100) - (symbolMap[symbolB].order || 100)
        );
      });
      let titleString = titles.map((entry) => entry[1]).join("  ");
      tray.setTitle(titleString, {
        fontType: "monospacedDigit",
      });
      lastMessageTime = Date.now();
    };

    ws.onopen = () => console.log("Connected to Binance WebSocket ✅");
    ws.onerror = (error) => {};
    ws.onclose = () => {
      console.warn("🔌 WS closed. Retrying...");
      setTimeout(() => fetchLivePrices(tray, symbols), retryDelay);
    };
  } catch (error) {
    console.log("Fetch error: ", error);
  }
}

app.whenReady().then(() => {
  const tray = new Tray("icon.png"); // Set your tray icon

  fetchLivePrices(tray, symbols);
  monitorHeartbeat(tray, symbols);
  const RED = "\x1b[31;1m"; // ANSI escape for bright red
  const RESET = "\x1b[0m"; // Reset color

  tray.setTitle(`${RED}OK${RESET}`, {
    fontType: "monospacedDigit",
  });
});
