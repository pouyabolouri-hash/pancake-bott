// index.js
// PancakeSwap Triangular Arbitrage Scanner (ethers v5 compatible)

const { ethers } = require("ethers");
const fetch = require("node-fetch");

// --- Provider (ethers v5) ---
const BSC_RPC = "https://bsc-dataseed.binance.org/";
const provider = new ethers.providers.JsonRpcProvider(BSC_RPC);

// PancakeSwap Router V2
const routerAddress = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const routerABI = [
  "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)"
];
const router = new ethers.Contract(routerAddress, routerABI, provider);

// Subgraph PancakeSwap (برای گرفتن کل جفت‌ها)
const SUBGRAPH_URL = "https://bsc.streamingfast.io/subgraphs/name/pancakeswap/exchange-v2";

// کارمزد و اسلیپیج
const FEE = 0.0025;     // 0.25% per swap (تقریبی)
const SLIPPAGE = 0.005; // 0.5%

// گرفتن لیست جفت‌ها از ساب‌گراف
async function fetchPairs(limit = 50) { // کم نگه داریم تا تست راحت‌تر بشه
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
  return data.data && data.data.pairs ? data.data.pairs : [];
}

// گرفتن قیمت خروجی (ethers v5: utils.formatUnits)
async function getAmountOut(amountInWei, path) {
  try {
    const amounts = await router.getAmountsOut(amountInWei, path);
    // فرض ساده: 18 دسیمال (برای تست). برای دقت بالا باید decimals هر توکن رو بخونیم.
    return Number(ethers.utils.formatUnits(amounts[amounts.length - 1], 18));
  } catch (err) {
    return null;
  }
}

// بررسی یک مسیر مثلثی A->B->C->A
async function checkTriangle(a, b, c) {
  const amountInWei = ethers.utils.parseUnits("1", 18); // 1 واحد از توکن A (ساده‌سازی)

  try {
    // A -> B
    const out1 = await getAmountOut(amountInWei, [a, b]);
    if (!out1) return;

    // B -> C
    const out2Wei = ethers.utils.parseUnits(out1.toString(), 18);
    const out2 = await getAmountOut(out2Wei, [b, c]);
    if (!out2) return;

    // C -> A
    const out3Wei = ethers.utils.parseUnits(out2.toString(), 18);
    const out3 = await getAmountOut(out3Wei, [c, a]);
    if (!out3) return;

    // کم‌کردن کارمزدهای استخر (تقریباً 0.25% هر سوآپ) و اسلیپیج
    const finalOut = out3 * (1 - 3 * FEE) * (1 - SLIPPAGE);
    const profit = finalOut - 1;

    if (profit > 0) {
      console.log(`✅ آربیتراژ سودده: ${a} → ${b} → ${c} → ${a} | سود تقریبی: ${(profit * 100).toFixed(3)}%`);
    }
  } catch (e) {
    // مسیرهای بی‌نقد/خطادار نادیده گرفته می‌شوند
  }
}

// ران اصلی
async function main() {
  console.log("⏳ در حال گرفتن جفت‌ارزها از ساب‌گراف...");
  const pairs = await fetchPairs(50); // بعداً می‌تونی زیادش کنی

  // جمع‌آوری آدرس توکن‌ها
  const tokens = [];
  for (const p of pairs) {
    if (p.token0?.id) tokens.push(p.token0.id);
    if (p.token1?.id) tokens.push(p.token1.id);
  }
  const uniqueTokens = Array.from(new Set(tokens));
  console.log(`📊 ${uniqueTokens.length} توکن برای تست`);

  // فقط 10×10×10 مسیر برای تست اولیه (بعداً می‌تونی گسترش بدی)
  const N = Math.min(uniqueTokens.length, 10);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      for (let k = 0; k < N; k++) {
        if (i !== j && j !== k && i !== k) {
          await checkTriangle(uniqueTokens[i], uniqueTokens[j], uniqueTokens[k]);
        }
      }
    }
  }
  console.log("✅ اسکن تستی تمام شد.");
}

main().catch(e => console.error("Error:", e));
