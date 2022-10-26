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
  static getLatLngRect(lat, lng, radius) {
    const radiusLat = 0.01096 * radius;
    const radiusLng = 0.00901 * radius;
    const halfLat = radiusLat / 1.4142;
    const halfLng = radiusLng / 1.4142;
    const latTop = lat + halfLat;
    const latBottom = lat - halfLat;
    const lngLeft = lng - halfLng;
    const lngRight = lng + halfLng;
    return {
      bottomleft: [latBottom, lngLeft],
      topright: [latTop, lngRight],
    };
  }
}
