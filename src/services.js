// src/services.js 完整替換或修改 fetchPassengerFlow 函式

const FLOW_GAS_URL = "https://script.google.com/macros/s/AKfycbzyvo8pE59kneyvd6DzO79QhFBhNAn6n9rD6ybQ90zJqAucESClHDfwzgYc8uShqnc/exec?action=flowSummary";
const CACHE_KEY = "TYM_LOCAL_PASSENGER_FLOW";

export async function fetchPassengerFlow(onCacheLoaded) {
  // 1. 本地快取讀取（容錯處理）
  try {
    const cachedStr = localStorage.getItem(CACHE_KEY);
    if (cachedStr && typeof onCacheLoaded === 'function') {
      onCacheLoaded(JSON.parse(cachedStr));
    }
  } catch (e) {
    console.warn("[Cache] 本地快取讀取略過:", e);
  }

  // 2. 設置 12 秒連線逾時，防止 GAS 伺服器掛起時將前端狀態永久鎖死
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  // 3. 加入防快取隨機參數 (_t=時間戳)，強制瀏覽器與 GAS 建立全新連線
  const noCacheUrl = `${FLOW_GAS_URL}&_t=${Date.now()}`;

  try {
    const res = await fetch(noCacheUrl, {
      method: "GET",
      cache: "no-store", // 禁用快取
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP 錯誤: ${res.status}`);
    }

    const result = await res.json();
    const flowData = (result && result.data) ? result.data : result;

    if (flowData && (flowData.totals || flowData.stationStats)) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(flowData));
      } catch (e) {}
      return flowData;
    }

    throw new Error("回傳運量資料格式不完整");
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("人流 GAS 連線異常：", error);
    throw error;
  }
}