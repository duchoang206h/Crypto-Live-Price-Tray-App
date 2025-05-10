const { app, Tray } = require("electron");
const WebSocket = require("ws");
let ws;
let dataMap = new Map();
const symbolConfigs = require("./symbol.config.json");
const symbolMap = {};
const symbols = [];

symbolConfigs.forEach((s) => {
  symbolMap[s.symbol] = { order: s.order, decimal: s.decimal };
  symbols.push(s.symbol + "USDT");
});

function fetchLivePrices(tray, symbols) {
  if (symbols.length === 0) return;
  const streams = symbols
    .map((symbol) => `${symbol.toLowerCase()}@ticker`)
    .join("/");
  const retryDelay = 5000;
  const connect = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
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
      const changePercent = Math.abs(parseFloat(data.P).toFixed(1));

      // Decide color based on change
      const color = changePercent < 0 ? RED : GREEN;
      const arrow = changePercent < 0 ? "↓" : "↑";

      // Output
      const title = `${symbol}${color}${price}${arrow}${changePercent}${RESET}`;
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
      //mb.tray.setTitle(`₿ ${coin.price}`);
    };

    ws.onopen = () => console.log("Connected to Binance WebSocket ✅");
    ws.onerror = (error) => console.error("WebSocket error:", error);
    ws.onclose = () => {
      console.log("Websocket closed. Retrying");
      setTimeout(connect, retryDelay);
    };
  };
  connect();
}

app.whenReady().then(() => {
  const tray = new Tray("icon.png"); // Set your tray icon

  fetchLivePrices(tray, symbols);
  const RED = "\x1b[31;1m"; // ANSI escape for bright red
  const RESET = "\x1b[0m"; // Reset color

  tray.setTitle(`${RED}OK${RESET}`, {
    fontType: "monospacedDigit",
  });
});
