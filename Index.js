// index.js
// PancakeSwap Triangular Arbitrage Scanner
// Full Pairs Auto Fetch

const { ethers } = require("ethers");
const fetch = require("node-fetch");

const BSC_RPC = "https://bsc-dataseed.binance.org/";
const provider = new ethers.JsonRpcProvider(BSC_RPC);

// PancakeSwap Router
const routerAddress = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const routerABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)"
];
const router = new ethers.Contract(routerAddress, routerABI, provider);

// Subgraph PancakeSwap (برای گرفتن کل جفت‌ها)
const SUBGRAPH_URL = "https://bsc.streamingfast.io/subgraphs/name/pancakeswap/exchange-v2";

// کارمزد و اسلیپیج
const FEE = 0.0025;
const SLIPPAGE = 0.005;

// گرفتن لیست جفت‌ها از ساب‌گراف
async function fetchPairs(limit = 1000) {
  const query = `
  {
    pairs(first: ${limit}) {
      id
      token0 { id symbol decimals }
      token1 { id symbol decimals }
    }
  }`;

  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query })
  });

  const data = await res.json();
  return data.data.pairs;
}

// گرفتن قیمت خروجی
async function getAmountOut(amountIn, path) {
  try {
    const amounts = await router.getAmountsOut(amountIn, path);
    return Number(ethers.formatUnits(amounts[amounts.length - 1], 18));
  } catch (err) {
    return null;
  }
}

// بررسی یک مسیر مثلثی
async function checkTriangle(a, b, c) {
  const amountIn = ethers.parseUnits("1", 18);

  try {
    const out1 = await getAmountOut(amountIn, [a, b]);
    if (!out1) return;

    const out2 = await getAmountOut(ethers.parseUnits(out1.toString(), 18), [b, c]);
    if (!out2) return;

    const out3 = await getAmountOut(ethers.parseUnits(out2.toString(), 18), [c, a]);
    if (!out3) return;

    const finalOut = out3 * (1 - 3 * FEE) * (1 - SLIPPAGE);
    const profit = finalOut - 1;

    if (profit > 0) {
      console.log(`✅ آربیتراژ: ${a} → ${b} → ${c} → ${a}`);
      console.log(`سود: ${(profit * 100).toFixed(3)}%`);
    }
  } catch (e) {}
}

// ران اصلی
async function main() {
  console.log("⏳ در حال گرفتن جفت ارزها...");
  const pairs = await fetchPairs(50); // تست با 50 جفت (میتونی زیاد کنی)

  // توکن‌ها رو جمع کنیم
  const tokens = [];
  pairs.forEach(p => {
    tokens.push(p.token0.id);
    tokens.push(p.token1.id);
  });

  const uniqueTokens = [...new Set(tokens)];
  console.log(`📊 ${uniqueTokens.length} توکن پیدا شد`);

  // تست مثلث‌ها
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      for (let k = 0; k < 10; k++) {
        if (i !== j && j !== k && i !== k) {
          await checkTriangle(uniqueTokens[i], uniqueTokens[j], uniqueTokens[k]);
        }
      }
    }
  }
}

main();
