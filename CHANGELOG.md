# 變更紀錄

本檔案記錄 Taiwan Traffic Simulator 的功能與架構更新。資料來源狀態以程式中的 `LIVE`、`ESTIMATED`、`SCHEDULED` 為準。

## 2026-09-10

### 真實資料嚴格模式

- Production 預設關閉 demo schedule，不再把程式生成班次標示成 SCHEDULED 官方資料。
- 沒有官方班次或即時資料時，provider 回傳空集合並由 UI 顯示空資料狀態。
- 新增 `VITE_ENABLE_DEMO_DATA=false`；只有本地明確設定為 `true` 才能測試 demo 動畫。
- 更新 README、架構與功能文件，列出各路線目前已驗證資料與尚待官方班表的範圍。

### 情境行進模擬

- 新增 `ScenarioScene.vue` 2D 沿線情境視圖。
- 依實際路線、站點與地理資料呈現城市、山勢、道路、機場與高架軌道情境。
- 車輛以場景中的完整車體持續沿站間 progress 行進。
- 新增目前行車表；點擊列車會切換至該車的情境行進畫面。
- 明確標示場景是地理情境模擬，不是 GPS LIVE 位置。

### 3D 地圖與旅程模擬

- 新增 Three.js WebGL 3D 地圖視圖，可切換總覽、跟車旅程與車內視角。
- 支援拖曳平移、旋轉、滾輪縮放與重置視角。
- 加入 OpenStreetMap 北部地理參考底圖與 attribution。
- 使用公開 OSM railway station 節點座標校準北部車站投影。
- 列車以立體車體、窗戶、車頂、車輪、陰影與行進方向呈現。
- 列車支援 3D hover 放大、點選與詳細資訊面板。
- 新增科技風／可愛風切換，運行資料不因視覺風格改變。
- 新增站體、道路、建築區塊、樹木等沿線環境模型。
- 列車抵站後會停靠於站體，顯示「停靠中」，再於下一段發車時繼續行駛。
- 車頭與跟車／車內鏡頭依目前站到下一站的地理向量轉向。

### 北部路網

- 保留板南線 BL01–BL23。
- 保留桃園機場捷運 A1–A22，支援普通車與直達車。
- 保留新北環狀線 Y07–Y20。
- 新增淡水信義線 R02–R28。
- 新增松山新店線 G01–G19。
- 新增中和新蘆線迴龍段 O01–O21 與蘆洲段 O50–O54。
- 新增文湖線 BR01–BR24。
- 文湖線使用班距式 SCHEDULED fallback，未捏造固定時刻表。

### Provider 與資料可靠性

- 建立 `TRTCProvider`、`TYMCProvider`、`NTMCProvider` 與 `ScheduledProvider`。
- 建立統一 `TrainState` mapping 邊界。
- 桃捷官方站間資料移至 Netlify Function server-side 抓取。
- 桃捷官方資料加入 schema validation、三次重試與 stale cache fallback。
- 北捷保留會員 API adapter，不猜測官方 endpoint、credential 或欄位。
- 明確區分 `LIVE`、`ESTIMATED`、`SCHEDULED`，目前 demo 與官方站間秒數推算均不宣稱 LIVE。

### 建置與開發

- 新增固定版本 `vite.config.js` 與 Vue plugin 設定。
- 套件版本固定，Three.js 拆成獨立 bundle。
- 新增 `.env.example` 與 `.gitignore`。
- README 補充 architecture、data flow、官方來源、環境變數與部署說明。

## 未完成項目

- 北捷會員即時列車位置／到站 API 尚未取得授權與正式欄位，因此沒有 LIVE 資料。
- 新增北捷四條路線目前使用 SCHEDULED fallback，尚未接正式站間秒數與完整班表。
- OSM 底圖是地理參考圖層，不是本專案的列車定位來源。
- 3D 車輛是程式化模型，不是營運單位 CAD 車輛模型。
