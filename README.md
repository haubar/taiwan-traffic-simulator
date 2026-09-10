# Taiwan Traffic Simulator / 台灣軌道交通模擬器

以交通數位分身概念，將北部捷運與機場捷運的列車狀態呈現在 schematic 控制中心介面。目前展示台北捷運板南線 BL01–BL23、淡水信義線 R02–R28、松山新店線 G01–G19、中和新蘆線 O01–O21／O50–O54、文湖線 BR01–BR24、桃園機場捷運 A1–A22 與新北環狀線 Y07–Y20，並可在指定時間查看列車所在站間、下一站、ETA 與站間進度。

平面圖與 3D 地圖可由工具列切換。3D 視圖使用 Three.js 建立地形、道路、建築區塊、站體、軌道與立體車輛；可拖曳平移／旋轉、滾輪縮放。3D 提供總覽、跟車旅程與車內視角：跟車會追蹤目前選取的列車（未選取時跟隨第一列運行中列車），車內視角則將鏡頭放在列車前端朝行車方向觀察。車輛依模擬時間沿站間路徑平滑前進，並可看到站體與沿線環境。現階段底圖是依北部路網拓撲建立的數位分身，不是 GPS 實景、地圖圖磚或 CAD 車輛模型；後續可替換為授權的 GIS／3D 地圖圖層。

新增「情境行進」視圖：依實際路線、站點名稱與地理座標建立城市、山勢、道路、機場、高架軌道等場景，列車會沿站間路徑持續行進，點擊班次即可轉場觀察該列車。這是地理情境模擬，不代表列車已取得 GPS 即時訊號。

3D 也可切換科技風與可愛風；可愛風使用柔和色彩、圓潤車體、表情車頭、樹木與糖果色城市模型，運行資料與地理座標不變。

列車抵達站點後會在站體位置停靠，顯示「停靠中」，待下一段發車時間才繼續行駛，避免列車在時刻表區段交界短暫消失。

3D 視圖另提供北部區域的 [OpenStreetMap](https://www.openstreetmap.org/copyright) 地圖圖磚作為地理參考底圖，並在畫面標示 attribution。底圖提供城市道路與區域脈絡，列車位置仍由 provider 的 SCHEDULED／ESTIMATED／LIVE 狀態決定，不會因為有地圖底圖就宣稱為即時 GPS。

車站地理校準使用公開 OSM railway station 節點資料，集中在 `src/data/geography.js`，並以 Web Mercator 近似投影到畫布；它是地理參考層，不是列車定位資料。少數未帶專案站碼的站點使用相鄰站插值，待接入官方車站座標資料後可直接替換。

## Architecture

```text
Vue UI → providerService → TRTCProvider / TYMCProvider → Netlify Function → 官方資料 adapter + cache
```

`src/providers/types.js` 定義統一的 `TrainState`：`id`、`operator`、`lineId`、`trainType`、`direction`、`fromStation`、`toStation`、`departureTime`、`arrivalTime`、`progress`、`source`、`updatedAt`。UI 只接收 provider 資料，不直接讀政府 API。

`TRTCProvider` 保留北捷會員 API adapter 邊界。未設定 key 時使用北捷各線 SCHEDULED fallback；不猜測官方會員 API 的 URL、認證或欄位。`TYMCProvider` 透過 Netlify Function 取得桃捷官方站間運行秒數，`NTMCProvider` 目前使用明確命名的環狀線 demo schedule。官方資料不可用時回到 fallback。完整功能與變更紀錄請見 [`docs/FEATURES.md`](docs/FEATURES.md)、[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) 與 [`CHANGELOG.md`](CHANGELOG.md)。

## Data flow

Vue 啟動時先以 demo schedule 呈現可用畫面，再由 `TYMCProvider` 呼叫 `/.netlify/functions/trains?operator=TYMC`。Netlify Function server-side 抓取並快取官方 CSV 15 分鐘，前端不直接連政府資料站。位置 composable 依指定模擬時間，在站間運行秒數間線性 interpolation。

## TrainState 與資料可信度

- `LIVE`：官方即時列車位置或到站資料；目前尚未啟用。
- `ESTIMATED`：由即時 ETA、營運狀態或其他即時訊號推算；目前尚未啟用。
- `SCHEDULED`：依官方時刻表與站間運行時間推算，絕不代表 GPS 即時位置。

目前畫面是 SCHEDULED。桃捷官方站間秒數是正式公開資料，但仍用於時刻表推算，因此 badge 保持 SCHEDULED。

## 官方資料來源

- [桃園捷運列車站間運行時間](https://data.gov.tw/dataset/76721)：桃園市政府資料開放平臺，欄位含路線、車種、站間序號、起訖站代號與站間行駛時間。下載 URL 與 parser 位於 `netlify/providers/tymc.mjs`。
- [桃捷各站時刻表](https://www.tymetro.com.tw/tymetro-new/tw/_pages/travel-guide/timetable.html)：提供 A1–A22、普通車／直達車與停靠站規則，也說明實際到站依當日運行狀況而定。
- [新北捷運環狀線車站](https://www.ntmetro.com.tw/basic/?node=10138)：官方列出 Y07 大坪林至 Y20 新北產業園區共 14 站；目前僅用於路網與 SCHEDULED fallback。
- 台北捷運官方 API：正式列車位置／到站資料需會員權限。本專案只預留 `TRTC_API_BASE` 與 `TRTC_API_KEY` adapter，不宣稱目前有 LIVE 連線。

## Local development

```bash
npm install
npm run dev
npm run build
```

需要 Node.js 18 或更新版本。Function 不可用時，Vite 畫面仍保留 demo fallback。

## Environment variables

Netlify Functions 預留 `TRTC_API_BASE`、`TRTC_API_KEY`；兩者只應放在 server-side。北捷 adapter 不會自行猜測認證標頭，必須在取得官方會員 API 文件後提供明確的 request-header mapping。Vite adapter 檢查用變數為 `VITE_TRTC_API_BASE`、`VITE_TRTC_API_KEY`。設定變數不會自動宣稱 LIVE，仍需完成官方欄位 mapping 與認證流程。

## Netlify deployment

`netlify.toml` 已指定 `npm run build`、`dist` 與 `netlify/functions`。連接 GitHub repository 後，在 Netlify Site settings 設定環境變數即可部署。Function 會快取桃捷公開資料 15 分鐘。

## Roadmap

1. 驗證北捷會員 API 欄位，完成 LIVE／ESTIMATED adapter。
2. 以桃捷官方完整班表取代 demo departure seeds，支援日期與服務異動。
3. 取得四條北捷新增路線的官方站間運行資料與完整班表。
4. 完成四條新增北捷路線的 LIVE／ESTIMATED adapter。
5. （目前範圍不包含台鐵、高鐵、公車與道路交通。）
