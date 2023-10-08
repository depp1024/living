/**
 * guiAddPlayer.js
 *
 * @author Yuki1907
 */

export class GuiAddPlayer {
  constructor(L) {
    var _this = this;
    this._panel = null;
    this.imageData = null;

    L.CustomControl = L.Control.extend({
      onAdd: function (map) {
        this._div = L.DomUtil.create("div", "");
        return this._div;
      },

      onRemove: function (map) {},

      setContent: function (latlng) {
        this._div.innerHTML =
          '<div>キャラクター作成</div><div><div>キャラクター名</div><input type="text" name="text" value="" /></div><div><div>アイコン</div><input id="icon" type="file" name="file"/></div><div><div>ニックネーム</div><div id="nick01">癒しの</div><div id="nick02">スポーツマン</div></div>' +
          '<a href="#" onclick="addPlayer();">追加</a>';

        this._div.innerHTML = '<iframe src="home.html" width="320" height="450" frameBorder="0" scrolling="no"/>';

        // let inputIconElement = document.getElementById("icon");
        // inputIconElement.addEventListener("change", roadImg, false);

        // function roadImg(e) {
        //   const file = this.files[0];
        //   let reader = new FileReader();
        //   reader.onload = () => {
        //     const imgData = reader.result;
        //     _this.imageData = imgData;
        //     // _this.imageData =  resizeImg(imgData);
        //     // localStorage.setItem('thumbnail', resizedImgData.result);
        //   };
        //   reader.readAsDataURL(file);
        // }

        // function resizeImg(imgData) {
        //   const canvas = document.createElement("canvas");
        //   canvas.width = 50;
        //   canvas.height = 50;
        //   const ctx = canvas.getContext("2d");
        //   ctx.drawImage(imgData, 0, 0, 50, 50);
        //   return canvas.toDataURL("image/png");
        // }
        return this;
      },

      _format: function (num) {
        return ("    " + num.toFixed(7)).slice(-12);
      },
    });

    L.customControl = function (opts) {
      return new L.CustomControl(opts);
    };
  }

  show(L, map, args) {
    this._panel = L.customControl({ position: "topleft" })
      .addTo(map)
      .setContent(args);
  }

  hide(map) {
    this._panel.remove(map);
  }

  getImageData() {
    return this.imageData;    
  }
}
