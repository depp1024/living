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

    // const routingCommentString = playerData["routing-comment"];
    // const routingCommentObject = routingCommentString
    //   .trim()
    //   .split("|")
    //   .map(function (item) {
    //     const array = item.trim().replace(/\s+/g, " ").split(" ");
    //     let keyValue = null;
    //     if (array.length > 0) {
    //       const key = array[0];
    //       array.shift();
    //       keyValue = { key, array };
    //     }
    //     return keyValue;
    //   });
    // this.routingCommentMap = new Map();
    // routingCommentObject.forEach((element) => {
    //   if (this.routingCommentMap.has(element.key) == false) {
    //     this.routingCommentMap.set(element.key, element.array);
    //   }
    // });

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
    const isMobile = window.innerWidth <= 768; // スマホ判定
    const iconSize = isMobile ? [60, 60] : [80, 80];
    const iconAnchor = [iconSize[0] / 2, iconSize[1]];
    const popupAnchor = [0, -iconSize[1]];

    const icon = this.L.divIcon({
      html: `<div class="character-icon" style="--character-color: ${this.color};">
           <img src="${url}" width="${iconSize[0]}" height="${iconSize[1]}">
         </div>`,
      iconSize: iconSize,
      iconAnchor: iconAnchor,
      popupAnchor: popupAnchor,
    });
    this.marker = this.L.marker(initialPeopleLatlng, {
      title: "Player",
      riseOnHover: true,
      icon: icon,
    });
    // マーカーにキャラクターの色を設定
    const markerElement = this.marker.getElement();
    if (markerElement) {
      markerElement.style.setProperty("--character-color", this.color);
    }

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
      { autoClose: false, autoPan: false }
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
    // if (this.routingCommentMap.has(this.destination_amenity)) {
    //   const amenityCommentArray = this.routingCommentMap.get(
    //     this.destination_amenity
    //   );
    //   const selectedCommentIndex = Math.round(
    //     UtilsMath.randomRange(0, amenityCommentArray.length - 1)
    //   );
    //   comment = "「" + amenityCommentArray[selectedCommentIndex] + "」";
    // }

    // if (comment == "" && this.destination_place != "") {
    //   console.log("comment nothing.");
    // }

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
    // console.log("[slideToAsync] call function. peopleID " + this.peopleID);

    if (nodes.length == 0) {
      return; // 移動ノードが１つもない場合は即座に終了
    }

    const speed = this.speed;
    let nodeIndex = 0;

    /**
     * 2つの座標間の距離と速度から移動にかかる時間を計算する関数
     *
     * @param {number} speed - 移動速度
     * @param {Object} srcLatLng - 出発地点の座標
     * @param {Object} destLatLng - 到着地点の座標
     * @returns {number} - 移動にかかる時間
     */
    const duration = (speed, srcLatLng, destLatLng) => {
      const distance = this.map.distance(srcLatLng, destLatLng);
      return distance / speed;
    };

    /**
     * 次のノードにスライドする関数
     *
     * @returns {Promise} - 移動完了を表すPromise
     */
    const slideToNextNode = async () => {
      if (nodeIndex >= nodes.length) {
        return; // すべてのノードに到達したら終了
      }

      const nextDurationTime =
        duration(speed, marker.getLatLng(), nodes[nodeIndex]) || 100;

      return new Promise((resolve) => {
        marker
          .slideTo(nodes[nodeIndex], {
            duration: nextDurationTime,
            keepAtCenter: false,
          })
          .once("moveend", async () => {
            await this.handleMoveEnd(marker);
            nodeIndex++;
            resolve();
          });
      });
    };

    // 全てのノードを順にスライド
    while (nodeIndex < nodes.length) {
      await slideToNextNode();
    }
  }

  /**
   * マーカーが移動終了したときの処理を行う関数
   *
   * @param {Object} marker - 移動したマーカーオブジェクト
   * @memberof People
   */
  async handleMoveEnd(marker) {
    if (!this.isTalking) {
      const closedPeople = People.getClosedPeople(this, 100);
      if (closedPeople.length > 0) {
        this.startTalking(closedPeople[0]);
      }
    }

    if (this.isTalking) {
      await this.talk();
    }
  }

  /**
   * 会話を開始するための初期設定を行う関数
   *
   * @param {Object} otherPerson - 会話の相手となる人物オブジェクト
   * @memberof People
   */
  startTalking(otherPerson) {
    this.isTalking = true;
    this.talkingOrder = 0;
    this.talkedPeopleList.push(otherPerson);
    this.talkedPeopleIDList.push(otherPerson.peopleID);
    otherPerson.isTalking = true;
    otherPerson.talkingOrder = 1;
    otherPerson.talkedPeopleList.push(this);
    otherPerson.talkedPeopleIDList.push(this.peopleID);
  }

  /**
   * 会話をシミュレートする関数
   *
   * @memberof People
   */
  async talk() {
    let nickname01 = this.nickname;
    let nickname02 =
      this.talkedPeopleList[this.talkedPeopleList.length - 1].nickname;

    if (this.talkingOrder != 0) {
      [nickname01, nickname02] = [nickname02, nickname01];
    }

    try {
      const talkArray = this.talkContents[nickname01][nickname02];
      this.marker.bounce(2);
      await People.wait(2000);

      const talkingTime = 5000;

      for (let i = 0; i < talkArray.length; i++) {
        if (talkArray[i].includes(this.nickname)) {
          let tagID = "peopleID" + this.peopleID;

          // キャラクター名を除去してセリフだけを取り出す
          let talkContent = talkArray[i].replace(/\[.*?\]\s*/, "");

          this.marker.bindPopup('<span id="' + tagID + '"/>' + talkContent, {
            autoClose: false,
            autoPan: false,
            className: "character-popup",
          });
          this.marker.openPopup();

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

          // キャラクター名を設定
          contentWrapper.attr("data-character-name", this.nickname);
          contentWrapper.css("--character-color", this.color);

          // 色の設定
          contentWrapper.css({
            "border-color": this.color,
            "background-color": "white",
          });
          tip.css({
            "border-color": this.color,
            "background-color": "white",
          });
        }

        await People.wait(talkingTime);
        this.marker.closePopup();
      }
    } catch (e) {
      console.error(e);
    }

    this.isTalking = false;
    this.talkingOrder = -1;
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
