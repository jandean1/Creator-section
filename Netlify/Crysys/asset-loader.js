// لایه ارتباطی توزیع‌شده با ساختار کاملاً مبهم
const DEST_UPLINK = (Netlify.env.get("API_REMOTE_SERVER") || "").replace(/\/$/, "");

const BLOCKED_SIGNATURES = new Set([
  "host", "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade", "forwarded",
  "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port",
  "x-real-ip", "x-forwarded-for", "x-forwarded-by",
  "sec-websocket-extensions", "sec-websocket-key", "sec-websocket-version"
]);

const CHROME_VERSIONS = ["120.0.0.0", "122.0.0.0", "124.0.0.0", "125.0.0.0"];

export default async function handler(req) {
  if (!DEST_UPLINK) {
    return new Response(JSON.stringify({ status: "online", sync: true }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }

  try {
    const parsedUrl = new URL(req.url);
    const connHeader = req.headers.get("connection")?.toLowerCase() || "";
    const upgradeHeader = req.headers.get("upgrade")?.toLowerCase() || "";
    
    // مسدود کردن درخواست‌های تانل مستقیم که بلافاصله رفتار پراکسی را لو می‌دهند
    if (upgradeHeader === "websocket" || connHeader.includes("upgrade")) {
      return new Response("Mismatched Protocol Architecture", { status: 426 });
    }

    const randomizedHeaders = new Headers();
    
    // شبیه‌سازی نوسانی اثر انگشت مرورگر برای شکستن امضای رفتاری ابزارها
    const selectedVer = CHROME_VERSIONS[Math.floor(Math.random() * CHROME_VERSIONS.length)];
    randomizedHeaders.set("user-agent", `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${selectedVer} Safari/537.36`);
    randomizedHeaders.set("accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8");
    randomizedHeaders.set("accept-language", "en-US,en;q=0.9");
    randomizedHeaders.set("cache-control", "max-age=0");
    randomizedHeaders.set("sec-ch-ua", `"Chromium";v="${selectedVer.split('.')[0]}", "Not-A.Brand";v="99"`);
    randomizedHeaders.set("sec-ch-ua-mobile", "?0");
    randomizedHeaders.set("sec-ch-ua-platform", '"Windows"');

    // مهندسی معکوس و تصفیه هدرهای کلاینت
    for (const [key, value] of req.headers) {
      const lowerKey = key.toLowerCase();
      if (BLOCKED_SIGNATURES.has(lowerKey) || lowerKey.startsWith("x-nf-") || lowerKey.startsWith("x-netlify-")) {
        continue;
      }
      randomizedHeaders.set(lowerKey, value);
    }

    // تزریق هدرهای کاذب سازمانی جهت فریب مانیتورینگ بیهوده ترافیک
    randomizedHeaders.set("x-amz-meta-routing", "edge-cluster-v4");
    randomizedHeaders.set("x-edge-trace-id", `trace-${Math.random().toString(36).substring(2, 11)}`);

    const currentMethod = req.method;
    const requestOptions = {
      method: currentMethod,
      headers: randomizedHeaders,
      redirect: "manual"
    };

    if (currentMethod !== "GET" && currentMethod !== "HEAD") {
      requestOptions.body = req.body;
    }

    const targetUrl = DEST_UPLINK + parsedUrl.pathname + parsedUrl.search;
    const originResponse = await fetch(targetUrl, requestOptions);

    const purifiedResponseHeaders = new Headers();
    for (const [resKey, resValue] of originResponse.headers) {
      const lowerResKey = resKey.toLowerCase();
      if (lowerResKey === "transfer-encoding" || lowerResKey === "server" || lowerResKey.startsWith("x-powered-")) {
        continue;
      }
      purifiedResponseHeaders.set(resKey, resValue);
    }

    // هدرهای امنیتی استاندارد فرانت‌هند برای گمراه‌سازی اسکنرهای امنیتی
    purifiedResponseHeaders.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    purifiedResponseHeaders.set("x-content-type-options", "nosniff");
    purifiedResponseHeaders.set("x-frame-options", "DENY");

    return new Response(originResponse.body, {
      status: originResponse.status,
      headers: purifiedResponseHeaders
    });

  } catch (err) {
    // بازگرداندن یک ساختار کاملاً طبیعی در صورت بروز خطا برای پنهان‌سازی ماهیت اصلی سرور
    return new Response(
      "<html><head><title>Runtime Synchronization</title></head><body><h1>Asset Optimization Active</h1><p>Dynamic CDN syncing in progress.</p></body></html>",
      {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" }
      }
    );
  }
}
