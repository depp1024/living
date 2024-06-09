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
   * @param {Object} talkContents - キャラクター同士の会話データ一式
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
    talkContents,
    L,
    map,
    rectLatLng,
    graph,
    graphNodeInfoArray,
    wayInfo,
    nodeInfoPlotTree,
    getNearestFunction
  ) {
    this.languageTopPriority =
      (window.navigator.languages && window.navigator.languages[0]) ||
      window.navigator.language ||
      window.navigator.userLanguage ||
      window.navigator.browserLanguage;

    this.talkContents = talkContents;

    this.peopleID = playerData["id"];
    this.nickname = playerData["nickname"];
    this.name =
      this.languageTopPriority == "ja"
        ? playerData["name:ja"]
        : playerData["name:en"];
    this.selfintroduction =
      this.languageTopPriority == "ja"
        ? playerData["self-introduction:ja"]
        : playerData["self-introduction:en"];
    this.littleword =
      this.languageTopPriority == "ja"
        ? playerData["a-little-word:ja"]
        : playerData["a-little-word:en"];
    this.iconURL = playerData["icon"];
    this.color = playerData["color"];
    this.speed = UtilsMath.randomRange(0.005, 0.015);
    this.routingPatternIndex = 0;

    const routingPatternString = playerData["routing-pattern"];
    this.routingPatternArray = routingPatternString
      .trim()
      .split("|")
      .map(function (item) {
        return item.trim().replace(/\s+/g, " ").split(" ");
      });

    const routingCommentString = playerData["routing-comment"];
    const routingCommentObject = routingCommentString
      .trim()
      .split("|")
      .map(function (item) {
        const array = item.trim().replace(/\s+/g, " ").split(" ");
        let keyValue = null;
        if (array.length > 0) {
          const key = array[0];
          array.shift();
          keyValue = { key, array };
        }
        return keyValue;
      });
    this.routingCommentMap = new Map();
    routingCommentObject.forEach((element) => {
      if (this.routingCommentMap.has(element.key) == false) {
        this.routingCommentMap.set(element.key, element.array);
      }
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
      this.languageTopPriority == "ja"
        ? {
            name: "名前:" + this.name,
            selfintroduction: "自己紹介:" + this.selfintroduction,
            littleword: "一言:" + this.littleword,
            destination: "現在の行き先:",
            place: "さっき寄った場所:",
            comment: "",
          }
        : {
            name: "Name:" + this.name,
            selfintroduction: "self-introduction:" + this.selfintroduction,
            littleword: "a little word:" + this.littleword,
            destination: "Destination:",
            place: "stopped by:",
            comment: "",
          };

    this.peopleList = null;
    this.isTalking = false;
    this.talkingOrder = -1;
    this.talkedPeopleList = new Array();
    this.talkedPeopleIDList = new Array();

    this.waitForSlideEnd = (peopleInstance, marker, nodes) =>
      console.log("[waitForSlideEnd]" + peopleInstance.peopleID);

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

        marker
          .slideTo(nodes[nodeIndex], {
            duration: nextDurationTime,
            keepAtCenter: false,
          })
          .on("moveend", async function () {
            if (peopleInstance.isTalking == false) {
              const closedPeople = People.getClosedPeople(peopleInstance, 100);
              if (closedPeople.length > 0) {
                console.log(
                  "moveend peopleID : " +
                    +peopleInstance.peopleID +
                    "," +
                    peopleInstance.nickname
                );
                console.log("closed people length : " + closedPeople.length);

                peopleInstance.isTalking = true;
                peopleInstance.talkingOrder = 0;
                peopleInstance.talkedPeopleList.push(closedPeople[0]);
                peopleInstance.talkedPeopleIDList.push(
                  closedPeople[0].peopleID
                );
                closedPeople[0].isTalking = true;
                closedPeople[0].talkingOrder = 1;
                closedPeople[0].talkedPeopleList.push(peopleInstance);
                closedPeople[0].talkedPeopleIDList.push(
                  peopleInstance.peopleID
                );
              }
            }

            if (peopleInstance.isTalking) {
              console.log("*** " + peopleInstance.nickname);

              let nickname01 = "";
              let nickname02 = "";
              if (peopleInstance.talkingOrder == 0) {
                nickname01 = peopleInstance.nickname;
                nickname02 =
                  peopleInstance.talkedPeopleList[
                    peopleInstance.talkedPeopleList.length - 1
                  ].nickname;
              } else {
                nickname01 =
                  peopleInstance.talkedPeopleList[
                    peopleInstance.talkedPeopleList.length - 1
                  ].nickname;
                nickname02 = peopleInstance.nickname;
              }

              try {
                const talkArray =
                  peopleInstance.talkContents[nickname01][nickname02];

                console.log(
                  "[Start Talking] " +
                    peopleInstance.peopleID +
                    "," +
                    peopleInstance.nickname +
                    "," +
                    peopleInstance.talkingOrder
                );

                peopleInstance.marker.bounce(2);
                await People.wait(2000);

                const talkingTime = 5000;

                for (let i = 0; i < talkArray.length; i++) {
                  if (talkArray[i].includes(peopleInstance.nickname)) {
                    let tagID = "peopleID" + peopleInstance.peopleID;
                    peopleInstance.marker.bindPopup(
                      '<span id="' + tagID + '"/>' + talkArray[i],
                      {
                        autoClose: true,
                      }
                    );
                    peopleInstance.marker.openPopup();

                    let spanTag = $("#" + tagID);
                    let contentWrapper = spanTag
                      .parent()
                      .parent()
                      .parent()
                      .find(".leaflet-popup-content-wrapper");
                    let tip = spanTag
                      .parent()
                      .parent()
                      .parent()
                      .find(".leaflet-popup-tip");
                    contentWrapper.css("border-color", peopleInstance.color);
                    tip.css("border-color", peopleInstance.color);
                    console.log(
                      "Color tagID " +
                        tagID +
                        " " +
                        peopleInstance.color +
                        " " +
                        peopleInstance.peopleID +
                        "," +
                        peopleInstance.nickname
                    );
                  }
                  await People.wait(talkingTime);
                  peopleInstance.marker.closePopup();
                }
              } catch (e) {}

              peopleInstance.isTalking = false;
              peopleInstance.talkingOrder = -1;
            }

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
    console.log("[run]" + this.peopleID);
    const indexStart = Math.round(
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

    const routingPatternCount = 500;
    for (
      let i = 0;
      i < this.routingPatternArray.length * routingPatternCount;
      i++
    ) {
      this.logMovement();
      this.setPlayerRoute(this.startPlotPoint, this.goalPlotPoint);
      console.log("[slideToAsync] start " + " peopleID " + this.peopleID + " index "+ i);
      await this.slideToAsync(
        this.marker,
        this.routeLatlngArray,
        this.routeNodeInfoArray
      );
      console.log("[slideToAsync] end " + " peopleID " + this.peopleID + " index "+ i);

      this.routingPatternIndex =
        (this.routingPatternIndex + 1) % this.routingPatternArray.length;
      this.startPlotPoint = this.goalPlotPoint;
      this.setNextGoalPlotPoint(
        this.startPlotPoint,
        this.routingPatternArray[this.routingPatternIndex],
        plotArray
      );
      this.updatePopup();

      // 目的地に到着してしばらく立ち止まり跳ねるアニメーション処理
      this.marker.toggleBouncing();
      // this.marker.bounce(2);
      // this.marker.openPopup();
      // await People.wait(2000);
      // this.marker.closePopup();
    }

    console.log("移動終了. PeopleID:" + this.name);
  }

  /**
   * 停止処理
   *
   * @param {Number} ms : 停止時間
   * @memberof People
   */
  async stop(ms) {
    await People.wait(ms);
  }

  /**
   * キャラクターのアイコンをクリックした際にポップアップで表示する情報を更新する関数
   *
   * @memberof People
   */
  updatePopup() {
    const popupName = this.popupContents.name + "<br>";
    const popupSelfintroduction = this.popupContents.selfintroduction + "<br>";
    const popupLittleWord = this.popupContents.littleword + "<br>";

    const popupDestination =
      this.popupContents.destination + this.destination_place + "<br>";

    const historyPlace =
      this.destinationHistoryArray.length > 1
        ? this.destinationHistoryArray[this.destinationHistoryArray.length - 2]
            .place
        : "";
    const popupHistoryPlace =
      historyPlace != ""
        ? this.popupContents.place + historyPlace + "<br>"
        : "";

    const popupHistoryPlaceBorderLine = popupHistoryPlace != "" ? "<br>" : "";

    const historyComment =
      this.destinationHistoryArray.length > 1
        ? this.destinationHistoryArray[this.destinationHistoryArray.length - 2]
            .comment + "<br>"
        : "";
    const popupHistoryComment =
      historyComment != "" ? this.popupContents.comment + historyComment : "";

    this.marker.bindPopup(
      popupName +
        popupSelfintroduction +
        popupLittleWord +
        popupDestination +
        popupHistoryPlaceBorderLine +
        popupHistoryPlace +
        popupHistoryComment,
      { autoClose: false }
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
      const historyObject = this.destinationHistoryArray.find(
        (value) => value.place == place_name
      );
      const isDestinationHistoryIncludes =
        historyObject != undefined ? true : false;
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
      const indexGoal = Math.round(
        UtilsMath.randomRange(0, plotArray.length - 1)
      );
      this.goalPlotPoint = plotArray[indexGoal];
      this.destination_place = "";
      this.destination_amenity = "";
    }

    // ルートがあるかチェックしてなければ現在地を目的地にしてもう一度別の場所を探すようにする
    const route = astar.search(
      this.graph,
      this.graph.grid[plotPoint.x][plotPoint.y],
      this.graph.grid[this.goalPlotPoint.x][this.goalPlotPoint.y]
    );
    if (route.length == 0) {
      this.goalPlotPoint = plotPoint;
    }

    let comment = "";
    if (this.routingCommentMap.has(this.destination_amenity)) {
      const amenityCommentArray = this.routingCommentMap.get(
        this.destination_amenity
      );
      const selectedCommentIndex = Math.round(
        UtilsMath.randomRange(0, amenityCommentArray.length - 1)
      );
      comment = "「" + amenityCommentArray[selectedCommentIndex] + "」";
    }

    if (comment == "" && this.destination_place != "") {
      console.log("comment nothing.");
    }

    this.destinationHistoryArray.push({
      place: this.destination_place,
      comment: comment,
    });
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
    console.log("[slideToAsync] call function. peopleID " + this.peopleID);
    await this.waitForSlideEnd(this, marker, nodes);
  }

  /**
   * キャラクターのリストをセットする関数
   * キャラクター同士の当たり判定を処理するため
   *
   * @param {Array.<Object>} list
   * @memberof People
   */
  setPlayerList(list) {
    this.peopleList = list;
  }

  /**
   * すれ違って話をする人を返却する関数
   * 距離が近く、すれ違い状態にいない人、まだ会話をしていない人を返却
   *
   * @param {Object} peopleInstance
   * @param {Number} radius
   * @return {boolean} true:近くにいる、false:近くにいない
   * @memberof People
   */
  static getClosedPeople(peopleInstance, radius) {
    return peopleInstance.peopleList.filter(function (people) {
      const own = peopleInstance.marker.getLatLng();
      const tgt = people.marker.getLatLng();
      const distance = peopleInstance.map.distance(own, tgt);
      return (
        distance < radius &&
        peopleInstance.peopleID != people.peopleID &&
        peopleInstance.isTalking == false &&
        people.isTalking == false &&
        peopleInstance.talkedPeopleIDList.includes(people.peopleID) == false
      );
    });
  }

  /**
   * 一時停止関数
   *
   * @param {Number} ms - 停止するミリ秒
   * @memberof People
   */
  static wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve();
      }, ms);
    });
  }

  /**
   * キャラクターの移動に関するログを表示
   *
   * @memberof People
   */
  logMovement() {
    return;
    console.log(
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
  }
}
