/**
 * 数学関連の処理をまとめたUtilityクラス
 *
 * @export
 * @class UtilsMath
 */
export class UtilsMath {
  /**
   * 指定のボックス内に入っているか判別する関数
   *
   * @static
   * @param {Number} x - x座標
   * @param {Number} y - y座標
   * @param {Number} minX - x座標の最小値(左)
   * @param {Number} minY - y座標の最小値(下)
   * @param {Number} maxX - x座標の最大値(右)
   * @param {Number} maxY - y座標の最大値(上)
   * @return {Boolean} 判定結果 true:ボックス内 false:ボックス外
   * @memberof UtilsMath
   */
  static isInsideBoxArea(x, y, minX, minY, maxX, maxY) {
    if (x >= minX && y >= minY && x <= maxX && y <= maxY) return true;
    return false;
  }

  /**
   * ある範囲内の数値でランダムな数字を生成する
   *
   * @static
   * @param {Number} min - 範囲の最小値
   * @param {Number} max - 範囲の最大値
   * @return {Number} ランダムな数字
   * @memberof UtilsMath
   */
  static randomRange(min, max) {
    const base = 100000;
    return Math.round((Math.random() * (max - min) + min) * base) / base;
  }

  /**
   * 緯度経度からX,Y座標に変換する
   *
   * @static
   * @param {Object.<Array.<Number>, Array.<Number>>} latlngRect - 緯度経度の矩形範囲
   * @param {Number} lat - 緯度
   * @param {Number} lng - 軽度
   * @return {Array.<Number, Number>} X,Y座標
   * @memberof UtilsMath
   */
  static convertLatlngToAsterCoordinate(latlngRect, lat, lng) {
    const pow = Math.pow(10, 5);
    let x = Math.floor((lat - latlngRect.bottomleft[0]) * pow);
    let y = Math.floor((lng - latlngRect.bottomleft[1]) * pow);
    return [x, y];
  }

  /**
   * X,Y座標から緯度経度へ変換
   *
   * @static
   * @param {Object.<Array.<Number>, Array.<Number>>} latlngRect - 緯度経度の矩形範囲
   * @param {Number} x - X座標
   * @param {Number} y - Y座標
   * @return {Array.<Number, Number>} 緯度経度
   * @memberof UtilsMath
   */
  static convertAsterToLatlngCoordinate(latlngRect, x, y) {
    const pow = Math.pow(10, 5);
    let lat = x / pow + latlngRect.bottomleft[0];
    let lng = y / pow + latlngRect.bottomleft[1];
    return [lat, lng];
  }

  /**
   * 緯度経度と半径から、緯度経度の矩形概算を求める
   *
   * @static
   * @param {Number} lat - 緯度
   * @param {Number} lng - 軽度
   * @param {Number} radius - 半径
   * @return {Object.<Array.<Number>, Array.<Number>>} latlngRect - 緯度経度の矩形範囲
   * @memberof UtilsMath
   */
  static getLatLngRect(lat, lng, radiusKm) {
    // 経度を -180〜180 に正規化する関数をローカル定義
    const normalizeLng = (lng) => ((((lng + 180) % 360) + 360) % 360) - 180;

    // 正規化した中心経度から開始
    lng = normalizeLng(lng);

    const earthRadiusKm = 6371;
    const dLat = (radiusKm / earthRadiusKm) * (180 / Math.PI);
    const dLng =
      ((radiusKm / earthRadiusKm) * (180 / Math.PI)) /
      Math.cos((lat * Math.PI) / 180);

    const latTop = lat + dLat;
    const latBottom = lat - dLat;

    // 左右端を計算してから正規化
    let lngLeft = normalizeLng(lng - dLng);
    let lngRight = normalizeLng(lng + dLng);

    // ±180 を跨いだ場合（例: 左が 170、右が -170）
    const crossesAntimeridian = lngLeft > lngRight;

    return {
      bottomleft: [latBottom, lngLeft],
      topright: [latTop, lngRight],
      crossesAntimeridian, // クエリ側で2分割するためのフラグ
    };
  }
}

// 乱数シード値を設定する関数
// Xorshiftアルゴリズムで疑似乱数生成
Math.random.seed = (function me(s) {
  // Xorshift128 (init seed with Xorshift32)
  s ^= s << 13;
  s ^= 2 >>> 17;
  s ^= s << 5;
  let x = 123456789 ^ s;
  s ^= s << 13;
  s ^= 2 >>> 17;
  s ^= s << 5;
  let y = 362436069 ^ s;
  s ^= s << 13;
  s ^= 2 >>> 17;
  s ^= s << 5;
  let z = 521288629 ^ s;
  s ^= s << 13;
  s ^= 2 >>> 17;
  s ^= s << 5;
  let w = 88675123 ^ s;
  let t;
  Math.random = function () {
    t = x ^ (x << 11);
    x = y;
    y = z;
    z = w;
    // >>>0 means 'cast to uint32'
    w = (w ^ (w >>> 19) ^ (t ^ (t >>> 8))) >>> 0;
    return w / 0x100000000;
  };
  Math.random.seed = me;
  return me;
})(0);
