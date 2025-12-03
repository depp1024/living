import { UtilsCSV } from "../utils/utils-csv.js";
import { UtilsMath } from "../utils/utils-math.js";

/**
 * OpenStreetMap APIクラス
 *
 * @export
 * @class OSMApi
 */
export class OSMApi {
  /**
   * OpenStreetMapのサーバの状態を問い合わせるAPI
   * 先方のサーバ負荷を抑える為、定められた遅延時間をあけて実行すること
   *
   * @static
   * @return {Object.<Boolean, Number>} - available:利用可能状態, waittime:サーバへの問合せ遅延時間
   * @memberof OSMApi
   */
  static async getAPIStatus() {
    console.log("request api status");
    const requestUrl = "https://overpass-api.de/api/status";
    return await fetch(requestUrl)
      .then((response) => {
        if (response.status === 200) {
          return response.text();
        } else {
          throw response;
        }
      })
      .then((data) => {
        let statusString =
          "Connected as: 3945337104\nCurrent time: 2022-03-02T13:10:08Z\nRate limit: 2\nSlot available after: 2022-03-02T13:10:31Z, in 23 seconds.\nCurrently running queries (pid, space limit, time limit, start time):\n2503653\t134217728\t60\t2022-03-02T13:09:57Z\n";
        statusString = data;
        try {
          let statusNow = statusString.split("\n")[3];
          if (statusNow.includes("after")) {
            const slotTime = new Date(
              statusNow
                .replace("Slot available after: ", "")
                .replace(/, in.*/, "")
            );
            const currentTime = new Date(
              statusString.split("\n")[1].replace("Current time: ", "")
            );
            const waitingTime = slotTime - currentTime;
            console.log("api waiting time : " + waitingTime);
            return { available: false, waittime: waitingTime };
          } else {
            console.log("api waiting time : 0");
            return { available: true, waittime: 0 };
          }
        } catch (e) {
          throw e;
        }
      })
      .catch((e) => {
        throw e;
      });
  }

  /**
   * OpenStreetMapから施設の情報を取得するAPI
   *
   * @static
   * @param {Number} lat - 緯度
   * @param {Number} lng - 軽度
   * @param {Number} radius - 半径
   * @param {Array} amenityArray - 取得してくる施設のカテゴリ検索クエリ文字列の配列
   * @param {Function} abortSignal - API中断用のシグナル関数
   * @return {Array} 施設情報データ
   * @memberof OSMApi
   */
  static async getFacilityInfo(lat, lng, radius, amenityArray, abortSignal) {
    console.log("request start getFacilityInfo:");
    const queryDefine = "[out:json][timeout:60][maxsize:134217728];";
    const queryContent = OSMApi.getFacilityQueryString(
      lat,
      lng,
      radius,
      amenityArray
    );
    const queryOut = "out body;";
    const queryString = queryDefine + queryContent + queryOut;
    const queryURLEncoded = encodeURI(queryString);
    const requestUrl =
      "https://overpass-api.de/api/interpreter?data=" + queryURLEncoded;

    let responseData = new Array();
    await fetch(requestUrl, { signal: abortSignal })
      .then((response) => {
        if (response.status === 200) {
          return response.json();
        } else {
          throw response;
        }
      })
      .then((res) => {
        for (let i = 0; i < res.elements.length; i++) {
          responseData.push(res.elements[i]);
        }
      })
      .catch((err) => {
        if (err.name == "AbortError") {
          console.log("cancel getFacilityInfo function");
        }
        console.log(err);
        throw err;
      });
    console.log("request end getFacilityInfo");
    return responseData;
  }

  /**
   * OpenStreetMapから道の情報を取得するAPI
   *
   * @static
   * @param {Number} lat - 緯度
   * @param {Number} lng - 軽度
   * @param {Number} radius - 半径
   * @param {Function} abortSignal - API中断用のシグナル関数
   * @return {Array} 道情報データ
   * @memberof OSMApi
   */
  static async getWayInfo(lat, lng, radius, abortSignal) {
    console.log("request start getWayInfo");
    const rectLatLng = UtilsMath.getLatLngRect(lat, lng, radius);
    const south = rectLatLng.bottomleft[0];
    const west = rectLatLng.bottomleft[1];
    const north = rectLatLng.topright[0];
    const east = rectLatLng.topright[1];

    const rects = rectLatLng.crossesAntimeridian
      ? [
          `(${south},${west},${north},180);`,
          `(${south},-180,${north},${east});`,
        ]
      : [`(${south},${west},${north},${east});`];

    const queryDefine = "[out:json][timeout:60][maxsize:134217728];";
    let queryContent = "(";
    for (const r of rects) {
      queryContent += `way[highway]${r}`;
    }
    queryContent += ");";
    const queryString = queryDefine + queryContent + "(._;>;);out;";
    const requestUrl =
      "https://overpass-api.de/api/interpreter?data=" +
      encodeURIComponent(queryString);

    let responseData = { node: {}, way: {} };
    await fetch(requestUrl, { signal: abortSignal })
      .then((response) => {
        if (response.status === 200) {
          return response.json();
        } else {
          throw response;
        }
      })
      .then((res) => {
        // get node and way data
        for (let i = 0; i < res.elements.length; i++) {
          if (res.elements[i].type == "node") {
            responseData.node[res.elements[i].id] = {
              lat: res.elements[i].lat,
              lon: res.elements[i].lon,
              tags: res.elements[i].tags,
            };
          } else if (res.elements[i].type == "way") {
            responseData.way[res.elements[i].id] = {
              nodes: res.elements[i].nodes,
              tags: res.elements[i].tags,
            };
            for (let j = 0; j < res.elements[i].nodes.length; j++) {
              const nodeID = res.elements[i].nodes[j];
              const wayID = res.elements[i].id;
              responseData.node[nodeID]["wayID"] = wayID;
              responseData.node[nodeID]["orderNumber"] = j;
            }
          }
        }
      })
      .catch((err) => {
        if (err.name == "AbortError") {
          console.log("cancel getWayInfo function");
        }
        console.log(err);
        throw err;
      });
    console.log("request end getWayInfo");
    return responseData;
  }

  /**
   * OpenStreetMapへリクエストする際のクエリを構築するための関数
   *
   * @static
   * @param {Number} lat - 緯度
   * @param {Number} lng - 軽度
   * @param {Number} radius - 半径
   * @param {Array.<Function>} amenityArray - 取得してくる施設のカテゴリ指定関数の配列
   * @return {String} OpenStreetMapへリクエストするクエリ形式になってる文字列
   * @memberof OSMApi
   */
  static getFacilityQueryString(lat, lng, radiusKm, amenityArray) {
    const rectLatLng = UtilsMath.getLatLngRect(lat, lng, radiusKm);

    const south = rectLatLng.bottomleft[0];
    const west = rectLatLng.bottomleft[1];
    const north = rectLatLng.topright[0];
    const east = rectLatLng.topright[1];

    // 2分割： [west, 180] と [-180, east]
    const rects = rectLatLng.crossesAntimeridian
      ? [`(${south},${west},${north},180)`, `(${south},-180,${north},${east})`]
      : [`(${south},${west},${north},${east})`];

    let str = "(";
    for (const amenity of amenityArray) {
      for (const r of rects) {
        str += amenity + r + ";";
      }
    }
    str += ");";
    return str;
  }

  /**
   * 施設の検索クエリ文字列一覧
   *
   * @static
   * @memberof OSMApi
   */
  static amenityQueryList = {
    // Food
    bar: "node[amenity=bar]",
    cafe: "node[amenity=cafe]",
    food_court: "node[amenity=food_court]",
    ice_cream: "node[amenity=ice_cream]",
    pub: "node[amenity=pub]",
    restaurant: "node[amenity=restaurant]",

    // Education
    college: "node[amenity=college]",
    library: "node[amenity=library]",
    school: "node[amenity=school]",
    university: "node[amenity=university]",

    // Health
    clinic: "node[amenity=clinic]",
    dentist: "node[amenity=dentist]",
    doctors: "node[amenity=doctors]",
    hospital: "node[amenity=hospital]",
    nursing_home: "node[amenity=nursing_home]",
    pharmacy: "node[amenity=pharmacy]",
    social_facility: "node[amenity=social_facility]",
    veterinary: "node[amenity=veterinary]",

    // Finance
    atm: "node[amenity=atm]",
    bank: "node[amenity=bank]",
    bureau_de_change: "node[amenity=bureau_de_change]",

    // Entertainment
    arts_centre: "node[amenity=arts_centre]",
    cinema: "node[amenity=cinema]",
    community_centre: "node[amenity=community_centre]",
    conference_centre: "node[amenity=conference_centre]",
    events_venue: "node[amenity=events_venue]",
    nightclub: "node[amenity=nightclub]",
    theatre: "node[amenity=theatre]",

    // PublicService
    courthouse: "node[amenity=courthouse]",
    fire_station: "node[amenity=fire_station]",
    police: "node[amenity=police]",
    post_office: "node[amenity=post_office]",
    prison: "node[amenity=prison]",
    townhall: "node[amenity=townhall]",
  };
}
