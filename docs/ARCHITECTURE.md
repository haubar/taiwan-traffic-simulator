# 程式架構規範

## 分層

```text
App.vue → composables → services → providers → data / Netlify Functions
                                      ├─ 官方資料 adapter
                                      └─ SCHEDULED fallback
```

- `App.vue`：組合畫面狀態與元件，不直接抓外部資料。
- `components/`：負責平面圖、3D renderer、時間軸與互動展示，不產生班表。
- `composables/`：負責模擬時間、跨午夜、站間 interpolation 與反應式狀態。
- `services/`：建立 provider、載入資料與組合跨來源流程。
- `providers/`：將不同營運者資料轉成共同介面；沒有正式來源時只能使用明確標示的 fallback。
- `data/`：保存路線、站點、地理投影與 demo schedule。
- `netlify/providers/`：server-side 官方資料 parser、schema validation、重試與 credential adapter。
- `netlify/functions/`：只對前端提供受控 endpoint，避免前端直接讀政府 API。

## JavaScript 規則

本專案的自訂 JavaScript 函式使用匿名箭頭函式並賦值給 `const`：

```js
export const formatClock = (seconds) => String(seconds)
```

避免使用 `function name() {}` 宣告自訂函式；生命週期 callback、事件 callback 與 parser 也遵循相同規則。Provider 使用 factory 回傳 object interface，避免 UI 依賴 class 實作。

## Vue 規則

- 使用 `<script setup>`。
- Props 只傳資料與狀態，事件透過 `defineEmits` 回傳。
- 3D renderer 的 WebGL 資源必須在 `onBeforeUnmount` 清理。
- UI 不直接呼叫外部資料來源。
- `source` 必須保留 `LIVE`、`ESTIMATED`、`SCHEDULED` 語意，視覺風格不得修改可信度。

## 資料流

1. `App.vue` 建立 provider service。
2. Provider 先回傳 fallback，確保畫面可用。
3. TYMC provider 呼叫 Netlify Function，Function server-side 取得官方 CSV 並快取。
4. Service 將官方站間資料套用至 schedule，失敗時保留 fallback。
5. `useTrainPosition` 依模擬時間輸出 TrainState 與畫面座標。
6. 平面圖與 3D 圖只消費標準化狀態。

## 新增路線流程

1. 在 `src/data/network.js` 加入路線與站點順序。
2. 在 `src/data/geography.js` 加入公開地理座標或明確註記 fallback／插值。
3. 在 `src/data/demoSchedules.js` 加入 demo fallback，來源保持 `SCHEDULED`。
4. 若有正式來源，在 `netlify/providers/` 新增 parser 與 schema validation。
5. 由 `providerService` 組合 provider，不在 component 內判斷營運者。
6. 執行 `npm run build`、資料 smoke test 與 `git diff --check`。
