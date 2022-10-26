/**
 * guiAddPlayer.js
 *
 * @author Yuki1907
 */

 class GuiAddPlayer {
    constructor(L) {
        this._panel = null;

        L.CustomControl = L.Control.extend({
            onAdd: function(map) {
                this._div = L.DomUtil.create('div', 'custom-panel leaflet-bar');
                return this._div;
            },
        
            onRemove: function(map) {
            },
        
            setContent: function(latlng) {
                latlng = latlng.wrap()
                this._div.innerHTML = '<pre class="coords">'
                                    + 'lat: ' + this._format(latlng.lat) + "\n"
                                    + 'lng: ' + this._format(latlng.lng)
                                    + '</pre>';
                return this;
            },
        
            _format: function(num) {
                return (('    ') + num.toFixed(7)).slice(-12);
            }
        });

        L.customControl = function(opts) {
            return new L.CustomControl(opts);
        }        
    }

    show(L, map, args) {
        this._panel = L.customControl({ position: 'topright' })
        .addTo(map)
        .setContent(args);
    }

    hide(map) {
        this._panel.remove(map)
    }
 }