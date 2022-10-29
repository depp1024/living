import { UtilsMath } from "../utils/utils-math.js";

/**
 * 地図上に現れるキャラクター(人)のクラス
 *
 * @export
 * @class People
 */
export class People {
  /**
   * Creates an instance of People.
   * @param {Object} playerData - キャラクターのデータ一式
   * @param {Object} L - Leafletのグローバルインスタンス
   * @param {Object} map - Leafletの地図関連のインスタンス
   * @param {Object.<Array.<Number>, Array.<Number>>} rectLatLng - 緯度経度の矩形範囲
   * @param {Object} graph - A*アルゴリズム検索用グラフ(キャラクターが移動できる道を定義)
   * @param {Array.<Array.<Number>>} graphNodeInfoArray- A*アルゴリズム検索用グラフに対応した施設情報(レストラン名等)の情報を格納したデータ
   * @param {Object} wayInfo - 道の情報
   * @param {Object} nodeInfoPlotTree - Kd Tree用のデータ
   * @param {Function} getNearestFunction - Kd Treeで検索する際の最短経路関数
   * @memberof People
   */
  constructor(
    playerData,
    L,
    map,
    rectLatLng,
    graph,
    graphNodeInfoArray,
    wayInfo,
    nodeInfoPlotTree,
    getNearestFunction
  ) {
    const languageTopPriority =
      (window.navigator.languages && window.navigator.languages[0]) ||
      window.navigator.language ||
      window.navigator.userLanguage ||
      window.navigator.browserLanguage;

    this.peopleID = playerData["id"];
    this.name =
      languageTopPriority == "ja"
        ? playerData["name:ja"]
        : playerData["name:en"];
    this.selfintroduction =
      languageTopPriority == "ja"
        ? playerData["self-introduction:ja"]
        : playerData["self-introduction:en"];
    this.comment =
      languageTopPriority == "ja"
        ? playerData["a-little-word:ja"]
        : playerData["a-little-word:en"];
    this.iconURL = playerData["icon"];
    this.speed = UtilsMath.randomRange(0.005, 0.015);
    this.routingPatternIndex = 0;

    const routingPatternString = playerData["routing-pattern"];
    this.routingPatternArray = routingPatternString
      .trim()
      .split("|")
      .map(function (item) {
        return item.trim().replace(/\s+/g, " ").split(" ");
      });

    this.L = L;
    this.map = map;
    this.rectLatLng = rectLatLng;
    this.graph = graph;
    this.graphNodeInfoArray = graphNodeInfoArray;
    this.marker = null;
    this.wayInfo = wayInfo;
    this.nodeInfoPlotTree = nodeInfoPlotTree;
    this.getNearestFunction = getNearestFunction;

    this.routeLatlngArray = null;
    this.routeNodeInfoArray = null;

    this.startPlotPoint = null;
    this.goalPlotPoint = null;

    this.destination_place = "";
    this.destinationHistoryArray = new Array();
    this.destination_amenity = "";

    this.popupContents =
      languageTopPriority == "ja"
        ? {
            name: "名前:" + this.name,
            destination: "目的地:",
            place: "立ち寄った場所:",
            selfintroduction: "自己紹介:" + this.selfintroduction,
            comment: "ちょっと一言:" + this.comment,
          }
        : {
            name: "Name:" + this.name,
            destination: "Destination:",
            place: "stopped by:",
            selfintroduction: "self-introduction:" + this.selfintroduction,
            comment: "a little word:" + this.comment,
          };

    this.waitForSlideEnd = (marker, nodes) =>
      new Promise((resolve) => {
        // 移動ノードが１つもない場合は移動させない
        if (nodes.length == 0) {
          resolve();
        }

        const speed = this.speed;
        let nodeIndex = 0;
        const duration = (speed, srcLatLng, destLatLng) => {
          const distance = this.map.distance(srcLatLng, destLatLng);
          return distance / speed;
        };

        let nextDurationTime = duration(
          speed,
          marker.getLatLng(),
          nodes[nodeIndex]
        );
        nextDurationTime = nextDurationTime != 0 ? nextDurationTime : 100;
        //console.log('peopleID:' + peopleID + ' index:' + nodeIndex + ' marker:' + marker.getLatLng() + ' duration:' + nextDurationTime);

        marker
          .slideTo(nodes[nodeIndex], {
            duration: nextDurationTime,
            keepAtCenter: false,
          })
          .on("moveend", function () {
            nodeIndex++;
            if (nodes.length <= nodeIndex) {
              resolve();
            } else {
              nextDurationTime = duration(
                speed,
                marker.getLatLng(),
                nodes[nodeIndex]
              );
              nextDurationTime = nextDurationTime != 0 ? nextDurationTime : 100;
              marker.slideTo(nodes[nodeIndex], {
                duration: nextDurationTime,
                keepAtCenter: false,
              });
            }
          });
      });
  }

  /**
   * メモリ解放関数
   *
   * @memberof People
   */
  dispose() {
    this.map.removeLayer(this.marker);
    this.marker = null;
    this.routeLatlngArray = null;
    this.routeNodeInfoArray = null;
  }

  /**
   * キャラクターを道上で動かし始める際の関数
   *
   * @param {Array.Object<Number, Number>} plotArray - 移動可能な場所を2次元配列で格納したデータ
   * @memberof People
   */
  async run(plotArray) {
    const indexStart = Math.floor(
      UtilsMath.randomRange(0, plotArray.length - 1)
    );
    this.startPlotPoint = plotArray[indexStart];
    let initialPeopleLatlng = UtilsMath.convertAsterToLatlngCoordinate(
      this.rectLatLng,
      this.startPlotPoint.x,
      this.startPlotPoint.y
    );

    const url = this.iconURL != "" ? this.iconURL : "";
    const iconSize = [50, 50];
    const icon = this.L.icon({
      iconUrl: url,
      iconSize: iconSize,
      iconAnchor: [iconSize[0] * 0.5, iconSize[1]],
      popupAnchor: [0, -iconSize[1]],
    });
    this.marker = this.L.marker(initialPeopleLatlng, {
      title: "Player",
      riseOnHover: true,
      icon: icon,
    });
    this.marker.addTo(this.map);

    this.setNextGoalPlotPoint(
      this.startPlotPoint,
      this.routingPatternArray[this.routingPatternIndex],
      plotArray
    );
    this.updatePopup();

    const routingPatternCount = 5;
    for (
      let i = 0;
      i < this.routingPatternArray.length * routingPatternCount;
      i++
    ) {
      console.log(
        "i:" +
          i +
          " " +
          this.name +
          ":" +
          " Destination:" +
          this.destination_place +
          " Amenity:" +
          this.destination_amenity +
          " " +
          this.startPlotPoint.x +
          "," +
          this.startPlotPoint.y +
          ":" +
          this.goalPlotPoint.x +
          "," +
          this.goalPlotPoint.y
      );
      this.setPlayerRoute(this.startPlotPoint, this.goalPlotPoint);
      await this.slideToAsync(
        this.marker,
        this.routeLatlngArray,
        this.routeNodeInfoArray
      );
      this.routingPatternIndex =
        (this.routingPatternIndex + 1) % this.routingPatternArray.length;
      this.startPlotPoint = this.goalPlotPoint;
      this.setNextGoalPlotPoint(
        this.startPlotPoint,
        this.routingPatternArray[this.routingPatternIndex],
        plotArray
      );
      this.updatePopup();
    }

    console.log("移動終了. PeopleID:" + this.name);
  }

  /**
   * キャラクターのアイコンをクリックした際にポップアップで表示する情報を更新する関数
   *
   * @memberof People
   */
  updatePopup() {
    const historyPlace =
      this.destinationHistoryArray.length > 1
        ? this.destinationHistoryArray[this.destinationHistoryArray.length - 2]
        : "";
    this.marker.bindPopup(
      this.popupContents.name +
        "<br>" +
        this.popupContents.destination +
        this.destination_place +
        "<br>" +
        this.popupContents.place +
        historyPlace +
        "<br>" +
        this.popupContents.selfintroduction +
        "<br>" +
        this.popupContents.comment
    );
  }

  /**
   * 次の目的地を更新する関数
   *
   * @param {Object<Number, Number>} plotPoint - 現地点を示す2次元配列のインデックス
   * @param {Array.Object<String>} amenityArray - 次の目的地の施設カテゴリデータ
   * @param {Array.Object<Number, Number>} plotArray - 移動可能な場所を2次元配列で格納したデータ
   * @memberof People
   */
  setNextGoalPlotPoint(plotPoint, amenityArray, plotArray) {
    let nearestDestinationNodeInfo = this.getNearestFunction(
      this.nodeInfoPlotTree,
      { x: plotPoint.x, y: plotPoint.y },
      1000
    );
    nearestDestinationNodeInfo = nearestDestinationNodeInfo.filter((data) => {
      let place_name = data[0].tags.name;
      if (window.navigator.languages != undefined) {
        for (let i = 0; i < window.navigator.languages.length; i++) {
          const tag_country = "name:" + window.navigator.languages[i];
          const tag_name_country = data[0].tags[tag_country];
          if (tag_name_country != undefined) {
            place_name = tag_name_country;
            break;
          }
        }
      }

      // distance != 0 : 現在いる地点ではない(距離が0ではない)
      // isDestinationHistoryIncludes == false : 過去に行った場所ではない
      // isAmenityIncludes : 行きたい場所の施設であること
      const distance = data[1];
      const isAmenityIncludes = amenityArray.includes(data[0].tags.amenity);
      const isDestinationHistoryIncludes =
        this.destinationHistoryArray.includes(place_name);
      return (
        distance != 0 &&
        isDestinationHistoryIncludes == false &&
        isAmenityIncludes == true
      );
    });

    if (nearestDestinationNodeInfo.length > 0) {
      this.goalPlotPoint = {
        x: nearestDestinationNodeInfo[0][0].x,
        y: nearestDestinationNodeInfo[0][0].y,
      };

      let place_name = nearestDestinationNodeInfo[0][0].tags.name;
      if (window.navigator.languages != undefined) {
        for (let i = 0; i < window.navigator.languages.length; i++) {
          const tag_country = "name:" + window.navigator.languages[i];
          const tag_name_country =
            nearestDestinationNodeInfo[0][0].tags[tag_country];
          if (tag_name_country != undefined) {
            place_name = tag_name_country;
            break;
          }
        }
      }
      this.destination_place = place_name;
      this.destination_amenity = nearestDestinationNodeInfo[0][0].tags.amenity;
    } else {
      const indexGoal = Math.floor(
        UtilsMath.randomRange(0, plotArray.length - 1)
      );
      this.goalPlotPoint = plotArray[indexGoal];
      this.destination_place = "";
      this.destination_amenity = "";
    }

    this.destinationHistoryArray.push(this.destination_place);
  }

  /**
   * 移動ルートをLeafletのnodeで格納する
   * 2次元配列から緯度経度情報へ変換が必要
   *
   * @param {Object.<Number, Number>} startPlotPoint - 移動開始地点(2次元配列データ)
   * @param {Object.<Number, Number>} goalPlotPoint - 移動終了地点(2次元配列データ)
   * @memberof People
   */
  setPlayerRoute(startPlotPoint, goalPlotPoint) {
    let route = astar.search(
      this.graph,
      this.graph.grid[startPlotPoint.x][startPlotPoint.y],
      this.graph.grid[goalPlotPoint.x][goalPlotPoint.y]
    );

    this.routeLatlngArray = new Array();
    this.routeNodeInfoArray = new Array();

    for (let i = 0; i < route.length; i++) {
      const x = route[i].x;
      const y = route[i].y;

      // 移動ルート上の座標を追加
      const latLng = UtilsMath.convertAsterToLatlngCoordinate(
        this.rectLatLng,
        x,
        y
      );
      this.routeLatlngArray.push(latLng);

      // 移動ルート上に施設情報があった場合にタグ情報を追加
      const nodeInfo = this.graphNodeInfoArray[x][y];
      if (nodeInfo != null) {
        const nodeID = nodeInfo[0].nodeID;
        const tags = this.wayInfo.node[nodeID].tags;
        this.routeNodeInfoArray.push({ nodeID: nodeID, tags: tags });
      }
    }
  }

  /**
   * Leafletの関数を使い地図上のピンを移動させる関数
   *
   * @param {Object} marker
   * @param {Array.<Object>} nodes
   * @memberof People
   */
  async slideToAsync(marker, nodes) {
    await this.waitForSlideEnd(marker, nodes);
  }
}
