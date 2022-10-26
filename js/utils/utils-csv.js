/**
 * CSV関連の処理をまとめたUtilityクラス
 * 
 * @export
 * @class UtilsCSV
 */
export class UtilsCSV {
  /**
   * 読み込んだCSVデータを二次元配列に変換する関数
   *
   * @static
   * @param {string} str 読み込んだCSVデータの文字列
   * @return {Array} 配列化されたCSVデータ
   * @memberof UtilsCSV
   */
  static convertCSVtoArray(str) {
    let result = [];
    str = str.replaceAll('"', "");
    str = str.replaceAll("\r", "");
    let tmp = str.split("\n");

    // 各行ごとにカンマで区切った文字列を要素とした二次元配列を生成
    for (var i = 0; i < tmp.length; ++i) {
      result[i] = tmp[i].split("\t");
    }
    return result;
  }    
}