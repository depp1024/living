import { UtilsCSV } from "../utils/utils-csv.js";

/**
 * GoogleAppsScript APIクラス
 * データベースであるGoogleドライブのスプレッドシートとやり取りする為
 *
 * @export
 * @class GASApi
 */
export class GASApi {
  /**
   * ユーザのセーブデータを取得するAPI
   * 将来的にユーザもキャラクタを追加する時用のAPI
   * 使い方：await getPlayerData({lat1:'35', lng1:'40', lat2:'130', lng2:'140'});
   * 指定の緯度経度矩形内にあるユーザデータを取得してくる
   *
   * @static
   * @param {Object.<String, String, String, String>} params - 取得したい範囲を緯度経度矩形で指定
   * @return {json} 範囲内にあるユーザデータ
   * @memberof GASApi
   */
  static async getPlayerData(params) {
    const gasPlayerURL =
      "https://script.google.com/macros/s/AKfycbyPdK6rPqumovucFR0pvhC6aih3VsZUh4NokIcPmBrTmD16lZ700nGEjPctJgWHpjN-/exec";

    return await fetch(
      gasPlayerURL +
        "?lat1=" +
        params.lat1 +
        "&lng1=" +
        params.lng1 +
        "&lat2=" +
        params.lat2 +
        "&lng2=" +
        params.lng2
    )
      .then((response) => {
        return response.json();
      })
      .then((res) => {
        if (res.meta.status != "success") {
          throw "failed to get player data from google spread sheet.";
        }

        res.data.forEach((element) => {
          console.log(
            "id:" +
              element.id +
              " name:" +
              element.name +
              " lat:" +
              element.lat +
              " lng:" +
              element.lng
          );
        });

        return res.data;
        //console.log(res.data);
      })
      .catch(console.error);
  }

  /**
   * ユーザのデータをデータベースにセーブするAPI
   * 将来的にユーザもキャラクタを追加する時用のAPI
   * 使い方：await postPlayerData('create', {id:'', name:'abcdef', lat:'135', lng:'35'});
   * 　　　　await postPlayerData('update', {id:6, name:'updateName', lat:'131', lng:'30'});
   *
   * @static
   * @param {String} crudType - 新規作成/データ上書き
   * @param {Object.<Number, String, String>} data - 入力データ
   * @memberof GASApi
   */
  static async postPlayerData(crudType, data) {
    const gasPlayerURL =
      "https://script.google.com/macros/s/AKfycbyPdK6rPqumovucFR0pvhC6aih3VsZUh4NokIcPmBrTmD16lZ700nGEjPctJgWHpjN-/exec";

    let bodyData = {
      crudType: crudType,
      id: data.id,
      name: data.name,
      lat: data.lat,
      lng: data.lng,
    };
    let postparam = {
      method: "POST",
      mode: "cors",
      body: JSON.stringify(bodyData),
      "Content-Type": "application/json",
    };

    await fetch(gasPlayerURL, postparam)
      .then((response) => {
        return response.json();
      })
      .then((res) => {
        if (res.message != "success") {
          throw "failed to post player data from google spread sheet.";
        }
      })
      .catch((err) => {
        console.log(err);
      });
  }
}
