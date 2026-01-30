import { UtilsMath } from "./utils/utils-math.js";
import { UtilsCSV } from "./utils/utils-csv.js";
import { People } from "./contents/people.js";
import { GuiAddPlayer } from "./contents/guiAddPlayer.js";
import { GASApi } from "./contents/api-googleappsscript.js";
import { OSMApi } from "./contents/api-openstreetmap.js";

/**
 * エントリーポイントMain関数
 *
 */
const main = async function () {
  // ===== Storage Key =====
  const GUIDE_POPUP_ALWAYS_SHOW = false; // ← テスト中は true、本番は false
  const LAST_VIEW_KEY = "wayawaya_last_view";

  // 乱数シード値初期化
  Math.random.seed(1);

  // global variables
  let osmAPIAbortController = null;

  // 地図の初期位置を設定
  // ブラウザから取得できる座標を優先
  // 取得できなかった場合は言語コードから国を推定しその首都に設定
  const defaultLatlng = await getDefaultLatlng();
  const defaultZoomLevel = 15;

  // area content
  let areaContentList = Array();
  let plotArray = null;
  let talkContents = {};
  let npcObjects = null;
  let centerLatlng = null;
  const queryRadius = 2.0;
  let rectLatLng = null;
  let graph = null;
  let graphNodeInfoArray = null;
  let wayInfo = null;
  let nodeInfoPlotTree = null;
  let facilityTree = null;
  let peopleList = null;
  window.addPlayer = addPlayer;

  // OpenStreetMapを扱うライブラリLeaflet関連の初期化
  let map = L.map("mapid", { zoomControl: false });
  L.control
    .zoom({
      position: "topright",
    })
    .addTo(map);

  // map.addControl(new L.Control.Fullscreen());
  let tileLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        '© <a href="https://osm.org/copyright">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
      className: "desaturated-map", // 新しいクラスを追加
    },
  );
  tileLayer.addTo(map);

  map.on("load", async function () {
    await addAreaContent(map);
    hideInitialLoading();
    showFirstGuidePopup();
  });
  map.setView([defaultLatlng.lat, defaultLatlng.lng], defaultZoomLevel);

  // 地図上の操作イベントハンドラ
  // map.on("keypress", async function (e) {
  //   if (e.originalEvent.key == "1") {
  //     addPlayer();
  //     // if (osmAPIAbortController) {
  //     //   osmAPIAbortController.abort();
  //     // }
  //   }
  // });

  let zoomLevelStart = map.getZoom();
  let zoomLevelEnd = map.getZoom();
  map.on("zoomstart", async function () {
    zoomLevelStart = map.getZoom();
  });

  map.on("zoomend", async function () {
    zoomLevelEnd = map.getZoom();
    console.log("zoomend:" + zoomLevelEnd);
    const thresholdZoomLevel = 14;
    if (
      zoomLevelStart <= thresholdZoomLevel &&
      thresholdZoomLevel < zoomLevelEnd
    ) {
      await addAreaContent(map);
    } else if (zoomLevelEnd <= thresholdZoomLevel) {
      clearAreaContent();
    }
  });

  map.on("moveend", () => {
    const center = map.getCenter();

    const data = {
      lat: center.lat,
      lng: center.lng,
    };

    localStorage.setItem(LAST_VIEW_KEY, JSON.stringify(data));
  });

  /**
   * 地図上にコンテンツを表示する関数
   *
   * @param {Object} map - Leafletのmapインスタンス
   */
  async function addAreaContent(map) {
    console.log("*****************************");
    console.log("add area content");
    osmAPIAbortController = new AbortController();
    try {
      const areaContent = await setupAreaContent(map, osmAPIAbortController);
      areaContentList.push(areaContent);
    } catch (err) {
      if (err.name == "AbortError") {
        console.log("cancel add area content");
        osmAPIAbortController = null;
        clearAreaContent();
      }
      console.log(err);
    }
    console.log("-----------------------------");
  }

  /**
   * 最短経路計算関数　Tree用
   * @param {*} tree
   * @param {*} searchPosition
   * @param {*} counts
   * @returns
   */
  function getNearestFunction(tree, searchPosition, counts) {
    let nearest = tree.nearest(searchPosition, counts);
    nearest.sort(function (first, second) {
      if (first[1] > second[1]) {
        return 1;
      } else if (first[1] < second[1]) {
        return -1;
      } else {
        return 0;
      }
    });
    return nearest;
  }

  function showOverlayPopup({
    id,
    html,
    autoCloseMs = null,
    fadeOutMs = 1000,
    closable = false,
  }) {
    const popup = document.createElement("div");
    popup.className = "overlay-popup";
    if (id) popup.id = id;

    popup.innerHTML = `
    <div class="overlay-popup-content">
      ${html}
      ${closable ? `<button class="overlay-close">OK</button>` : ""}
    </div>
  `;

    document.body.appendChild(popup);

    // フェードイン
    requestAnimationFrame(() => {
      popup.classList.add("show");
    });

    const close = () => {
      popup.classList.remove("show");
      setTimeout(() => popup.remove(), fadeOutMs);
    };

    if (closable) {
      popup.querySelector(".overlay-close").onclick = close;
    }

    if (autoCloseMs) {
      setTimeout(close, autoCloseMs);
    }

    return { close };
  }

  function showFirstGuidePopup() {
    const STORAGE_KEY = "wayawaya_first_guide_shown";

    if (!GUIDE_POPUP_ALWAYS_SHOW) {
      if (localStorage.getItem(STORAGE_KEY)) return;
      localStorage.setItem(STORAGE_KEY, "true");
    }

    showOverlayPopup({
      id: "wayawaya-first-guide",
      autoCloseMs: 11500,
      html: `
      <div class="guide-content">
        <p>
          🌍 This is a sample city.<br><br>

          Click the icon in the top-left<br>
          to move to your city.<br><br>

          You can also move the map<br>
          by dragging or tapping.
        </p>
      </div>
    `,
    });
  }

  function hideInitialLoading() {
    const el = document.getElementById("initial-loading");
    if (!el) return;
    el.classList.remove("show");
    setTimeout(() => el.remove(), 1000);
  }

  /**
   * 地図上のコンテンツをセットアップする関数
   *
   * @param {Object} map - Leafletのmapインスタンス
   * @param {Object} abortController - 関数途中で中断された際に反応するためのインスタンス
   * @return {Object} 生成されたコンテンツデータ
   */
  async function setupAreaContent(map, abortController) {
    // 共通処理
    centerLatlng = map.getCenter();
    const distanceUsingLatlon = function (a, b) {
      return map.distance(L.latLng(a.lat, a.lon), L.latLng(b.lat, b.lon));
    };
    const distanceUsingPlot = function (a, b) {
      return Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
    };

    console.log("set up way");
    rectLatLng = UtilsMath.getLatLngRect(
      centerLatlng.lat,
      centerLatlng.lng,
      queryRadius,
    );

    let nodeAsterBottomleft = UtilsMath.convertLatlngToAsterCoordinate(
      rectLatLng,
      rectLatLng.bottomleft[0],
      rectLatLng.bottomleft[1],
    );
    let nodeAsterTopright = UtilsMath.convertLatlngToAsterCoordinate(
      rectLatLng,
      rectLatLng.topright[0],
      rectLatLng.topright[1],
    );
    const nodeAsterSizeX = nodeAsterTopright[0] - nodeAsterBottomleft[0];
    const nodeAsterSizeY = nodeAsterTopright[1] - nodeAsterBottomleft[1];
    let graphArray = new Array(nodeAsterSizeX);
    graphNodeInfoArray = new Array(nodeAsterSizeX);
    for (let x = 0; x < nodeAsterSizeX; x++) {
      graphArray[x] = new Array(nodeAsterSizeY).fill(0);
      graphNodeInfoArray[x] = new Array(nodeAsterSizeY).fill(null);
    }

    wayInfo = null;
    try {
      const apiStatus = await OSMApi.getAPIStatus();
      await delay(apiStatus.waittime + 100);
      wayInfo = await OSMApi.getWayInfo(
        centerLatlng.lat,
        centerLatlng.lng,
        queryRadius,
        abortController.signal,
      );
    } catch (err) {
      throw err;
    }
    console.log("finished to set up way");

    console.log("set up facility");
    let facilityList = Array();
    let facilityInfo = null;

    try {
      const apiStatus = await OSMApi.getAPIStatus();
      await delay(apiStatus.waittime + 100);
      facilityInfo = await OSMApi.getFacilityInfo(
        centerLatlng.lat,
        centerLatlng.lng,
        queryRadius,
        Object.values(OSMApi.amenityQueryList),
        abortController.signal,
      );
    } catch (err) {
      throw err;
    }
    if (facilityInfo != null) {
      facilityInfo.forEach(function (element) {
        facilityList.push({
          lat: element.lat,
          lon: element.lon,
          tags: element.tags,
        });
      });
    }

    facilityTree = new kdTree(facilityList, distanceUsingLatlon, [
      "lat",
      "lon",
    ]);
    Object.keys(wayInfo.node).forEach(function (key) {
      try {
        let latLng = L.latLng(wayInfo.node[key].lat, wayInfo.node[key].lon);
        let nearestNodes = getNearestFunction(
          facilityTree,
          { lat: latLng.lat, lon: latLng.lng },
          1,
        );
        let distance = distanceUsingLatlon(
          { lat: nearestNodes[0][0].lat, lon: nearestNodes[0][0].lon },
          { lat: wayInfo.node[key].lat, lon: wayInfo.node[key].lon },
        );
        // meter
        const nearThreshold = 30;
        if (distance < nearThreshold)
          wayInfo.node[key].tags = nearestNodes[0][0].tags;
      } catch (err) {
        console.error(err);
        throw err;
      }
    });

    console.log("finished to set up facility");

    // create navigation map
    plotArray = new Array();
    let registeredNodeIDArray = new Array();
    for (const [, value] of Object.entries(wayInfo.way)) {
      if (value.nodes.length > 1) {
        for (let i = 0; i < value.nodes.length - 1; i++) {
          const nodeAsterPair = [
            UtilsMath.convertLatlngToAsterCoordinate(
              rectLatLng,
              wayInfo.node[value.nodes[i]].lat,
              wayInfo.node[value.nodes[i]].lon,
            ),
            UtilsMath.convertLatlngToAsterCoordinate(
              rectLatLng,
              wayInfo.node[value.nodes[i + 1]].lat,
              wayInfo.node[value.nodes[i + 1]].lon,
            ),
          ];

          const plotPointList = Bresenham.plot(
            nodeAsterPair[0][0],
            nodeAsterPair[0][1],
            nodeAsterPair[1][0],
            nodeAsterPair[1][1],
          );

          let debugIndex = 0;
          for (const point of plotPointList) {
            let x = point[0];
            let y = point[1];

            if (
              UtilsMath.isInsideBoxArea(
                x,
                y,
                0,
                0,
                nodeAsterSizeX - 1,
                nodeAsterSizeY - 1,
              )
            ) {
              graphArray[x][y] = 1;
              plotArray.push({ x: x, y: y });

              for (
                let pairIndex = 0;
                pairIndex < nodeAsterPair.length;
                pairIndex++
              ) {
                if (
                  x == nodeAsterPair[pairIndex][0] &&
                  y == nodeAsterPair[pairIndex][1]
                ) {
                  const nodeID = value.nodes[i + pairIndex];
                  const tags = wayInfo.node[nodeID].tags;
                  if (
                    tags != undefined &&
                    nodeID != undefined &&
                    registeredNodeIDArray.includes(nodeID) == false
                  ) {
                    if (tags.amenity != undefined && tags.name != undefined) {
                      if (graphNodeInfoArray[x][y] == null)
                        graphNodeInfoArray[x][y] = new Array();
                      graphNodeInfoArray[x][y].push({
                        x: x,
                        y: y,
                        nodeID: nodeID,
                        tags: tags,
                      });
                      registeredNodeIDArray.push(nodeID);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    const nodeInfoPlotArray = graphNodeInfoArray
      .flat()
      .filter((data) => data != null)
      .flat();
    nodeInfoPlotTree = new kdTree(nodeInfoPlotArray, distanceUsingPlot, [
      "x",
      "y",
    ]);

    graph = new Graph(graphArray);
    console.log("set up people");

    // talk content
    talkContents = {};
    let talkContentList = await readTalkData();

    talkContentList.forEach(function (element, index, array) {
      const line = element[0];

      // 最初の2つのカンマで区切る（セリフ内カンマは無視）
      const parts = line.split(/,(.*?,.*)/s);
      const key1 = parts[0].trim();
      const rest = parts[1] || "";
      const parts2 = rest.split(/,(.*)/s);
      const key2 = parts2[0].trim();
      const dialogueText = (parts2[1] || "").trim();

      // キャラ名: セリフ を順番に抽出
      // 名前は英数字・空白・ハイフンを含む可能性あり
      const regex = /([A-Za-z0-9\- ]+):\s*([^:]+?)(?=(?:[A-Za-z0-9\- ]+:|$))/gs;
      const talkList = [];
      let match;

      while ((match = regex.exec(dialogueText)) !== null) {
        const name = match[1].trim();
        const lineText = match[2].trim();
        talkList.push(`[${name}]${lineText}`);
      }

      // 格納
      const obj = {};
      obj[key2] = talkList;
      if (talkContents[key1] == null) talkContents[key1] = obj;
      else talkContents[key1][key2] = talkList;
    });

    // let test_player = new People(
    //   npcObjects[0],
    //   L,
    //   map,
    //   rectLatLng,
    //   graph,
    //   graphNodeInfoArray,
    //   wayInfo,
    //   nodeTreeFromWay,
    //   facilityTree,
    //   nodeInfoPlotTree,
    //   getNearestFunction
    // );
    // test_player.run(plotArray);
    peopleList = Array();
    npcObjects = await readNPCData();
    Object.keys(npcObjects).forEach(function (key) {
      try {
        let player = new People(
          npcObjects[key],
          talkContents,
          L,
          map,
          rectLatLng,
          graph,
          graphNodeInfoArray,
          wayInfo,
          nodeInfoPlotTree,
          getNearestFunction,
        );
        player.run(plotArray);
        peopleList.push(player);
      } catch (e) {
        console.error(e);
      }
    });

    peopleList.forEach((element) => element.setPlayerList(peopleList));

    console.log("finished to set up people");

    return {
      wayInfo: wayInfo,
      facilityList: facilityList,
      peopleList: peopleList,
    };
  }

  /**
   * 地図上のコンテンツをクリアする関数
   *
   */
  function clearAreaContent() {
    console.log("clear area content");
    areaContentList.forEach(function (content) {
      content.peopleList.forEach(function (people) {
        people.dispose();
        people = null;
      });
      content = null;
      plotArray = null;
      talkContents = {};
      npcObjects = null;
      centerLatlng = null;
      rectLatLng = null;
      graph = null;
      graphNodeInfoArray = null;
      wayInfo = null;
      nodeInfoPlotTree = null;
      facilityTree = null;

      peopleList = null;
    });
    areaContentList.length = 0;

    if (osmAPIAbortController != null) {
      osmAPIAbortController.abort();
      osmAPIAbortController = null;
    }
  }

  /**
   * 最初に表示する緯度経度を取得する関数
   * ブラウザの言語設定やNavigationLocation等から一番最適な値にする
   *
   * @return {Object.<Number, Number>} - デフォルトで表示する緯度経度
   */
  async function getDefaultLatlng() {
    const saved = localStorage.getItem(LAST_VIEW_KEY);

    if (saved) {
      try {
        const { lat, lng } = JSON.parse(saved);
        return { lat, lng };
      } catch {
        // 壊れてたら無視
      }
    }

    // itch.io最多ユーザ想定：US → New York
    // ※ 将来差し替えやすいように明示
    return {
      lat: 40.7128,
      lng: -74.006,
    };
  }

  /**
   * ブラウザから現在の位置情報を取得するための関数
   *
   * @return {Object} 現在の緯度軽度 navLocation.coords.latitude, navLocation.coords.longitude
   */
  async function getNavigateLocation() {
    return await new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      } else {
        throw "navigator.geolocation false";
      }
    });
  }

  /**
   * GoogleAppScriptを使いGoogleドライブに保存されているキャラクター情報を取得する関数
   *
   * @return {Array.<Object>} キャラクター情報一式
   */
  async function readNPCData() {
    // read npc data
    let csv = new XMLHttpRequest();
    csv.open("GET", getBasePath() + "/data/npc_name_en.csv", false);
    csv.send(null);
    const npcArray = UtilsCSV.convertCSVtoArray(csv.responseText);

    let itemList = npcArray.shift();
    itemList = itemList[0].split(",");
    const npcObjects = npcArray.reduce((result, item, index) => {
      result[index] = {};
      const valueArray = item[0].split(",");
      itemList.forEach((e, i) => {
        const itemName = e;
        const itemValue = valueArray[i];
        result[index][itemName] = itemValue;
      });
      return result;
    }, {});

    return npcObjects;
  }

  /**
   * プレイヤー追加API
   */
  function addPlayer() {
    // let iconImage = gui.getImageData();
    let iconImage = localStorage.getItem("thumbnail");

    const name = "Player";
    let playerInfo = {
      "a-little-word:en": "Workwash liquor",
      "a-little-word:ja": "はしご酒中",
      icon: iconImage,
      id: "1",
      "name:en": name,
      "name:ja": name,
      nickname: "梯子酒のOL",
      "routing-comment":
        "restaurant 飲んだ後はラーメンよね セットで1500円なんてハッピー|cafe BIGチョコレートパフェ！いぇい！|doctors 数値が心配… 健康診断怖い…|dentist 歯医者はいつ行かなくてよくなるんだろ|atm 飲み代こそっとおろそうっと|bank 飲み代こそっとおろそうっと",
      "routing-pattern": "restaurant cafe|doctors dentist|atm bank",
      "self-introduction:en": "I love alcohol",
      "self-introduction:ja": "お酒大好き",
    };

    let player = new People(
      playerInfo,
      talkContents,
      L,
      map,
      rectLatLng,
      graph,
      graphNodeInfoArray,
      wayInfo,
      nodeInfoPlotTree,
      getNearestFunction,
    );
    player.run(plotArray);
    peopleList.push(player);
    peopleList.forEach((element) => element.setPlayerList(peopleList));
  }

  // utility function
  const delay = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));
};

function getBasePath() {
  // GitHub Pages 環境かどうかを判定
  if (location.hostname.includes("github.io")) {
    return "/living/";
  } else {
    return "./";
  }
}

/**
 * キャラクター会話データ読み込み
 *
 * @return {*}
 */
async function readTalkData() {
  let csv = new XMLHttpRequest();
  csv.open("GET", getBasePath() + "data/character_conversations_en.csv", false);
  csv.send(null);
  return UtilsCSV.convertCSVtoArray(csv.responseText);
}

// エントリーポイント(Mainプログラム実行)
try {
  main();
} catch (e) {
  console.log(e);
}
