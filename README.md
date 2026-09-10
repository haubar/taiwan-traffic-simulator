# Taiwan Traffic Simulator / 台灣軌道交通模擬器

以「交通數位分身」概念呈現指定時間各列車在軌道路網中的推估位置。

## MVP
- 台北捷運板南線 BL01–BL23
- 桃園機場捷運 A1–A22
- 普通車 / 直達車視覺區分
- 目前時間、暫停、1x / 5x / 20x 模擬
- 時間軸拖曳
- 列車在兩站之間線性插值平滑移動
- 點擊列車顯示站間進度、下一站與預計抵達
- Demo 模式不需要 API Key

## 官方資料設計
北捷官方 API 服務包含車站時刻表、列車位置、列車到站資訊、發車班距與相鄰站旅行時間。其中列車位置/到站資訊屬會員專屬 API。因此正式 Live 模式應在 Serverless Function 端保存憑證，再轉為統一 TrainState 給前端。

桃園捷運政府開放資料包含車站基本資料與「列車站間運行時間」，欄位包含路線代碼、車種、起訖站及站間行駛時間，可用於班表模式的位置內插。

## 本地啟動
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Netlify
直接連接 GitHub repository；`netlify.toml` 已設定 build 與 functions 目錄。

## 下一步
1. 新增 provider 層：`TRTCProvider` / `TYMCProvider`
2. TRTC Function 串官方會員 API，將「下一站＋剩餘秒數」轉為 0~1 progress
3. 桃捷下載/快取官方時刻與站間時間，替代 Demo schedules
4. 增加所有北捷路線
5. 增加台中/高雄捷運、台鐵、高鐵
6. 最後加入公車 GPS、道路 VD、路況事件形成 Taiwan Traffic Digital Twin

## 資料可信度
前端建議固定呈現 `LIVE / ESTIMATED / SCHEDULED`，不可把班表插值誤標為 GPS 即時位置。
