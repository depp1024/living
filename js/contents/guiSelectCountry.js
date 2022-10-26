/**
 * guiSelectCountry.js
 *
 * @author Yuki1907
 */

import * as uikit from './lib/uikit.js';

export class GuiSelectCountry {
    constructor(L) {
        this._panel = null;

        L.CustomControl = L.Control.extend({
            onAdd: function(map) {
                this._div = L.DomUtil.create('div', 'custom-panel leaflet-bar');
                return this._div;
            },
        
            onRemove: function(map) {
            },
        
            setContent: function(args) {
                var optionStr = '<option></option>';
                args.splice(0,1);
                args.forEach(element => {
                    optionStr += '<option>' + element[5] + '</option>';
                });

                this._div.innerHTML =
                '<p>Choose playable country.</p>' +
                '<form>' +
                    '<select class="uk-select">' +
                        optionStr +
                    '</select>' +
                '</form>' +
                '<button class="uk-button" type="button">Start</button>';
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
        this._panel = L.customControl({ position: 'topleft' })
        .addTo(map)
        .setContent(args);
    }

    hide(map) {
        this._panel.remove(map)
    }
 }