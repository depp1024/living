/**
 * bresenham.js
 *
 * @author Yuki1907
 * @description https://ja.wikipedia.org/wiki/%E3%83%96%E3%83%AC%E3%82%BC%E3%83%B3%E3%83%8F%E3%83%A0%E3%81%AE%E3%82%A2%E3%83%AB%E3%82%B4%E3%83%AA%E3%82%BA%E3%83%A0
 * 
 */

class Bresenham {
    /**
     * @brief 
     * @param {*} x0 
     * @param {*} y0 
     * @param {*} x1 
     * @param {*} y1 
     * @returns 
     */
    static plot(x0, y0, x1, y1) {
        let plotList = new Array();
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);

        if(dx == 0 && dy == 0) {
            plotList.push([x0, y0]);
        }
        else if(dx == 0) {
            for(let y = y0; y <= y1; y++) {
                plotList.push([x0, y]);
            }
        }
        else if(dy == 0) {
            for(let x = x0; x <= x1; x++) {
                plotList.push([x, y0]);
            }
        }
        else {
            let sx = 1;
            let sy = 1;
            if(x0 < x1) sx = 1; else sx = -1;
            if(y0 < y1) sy = 1; else sy = -1;
            let err = dx - dy;

            while(true) {
                plotList.push([x0, y0]);
                if(x0 == x1 && y0 == y1) break;
                let e2 = 2 * err;
                if(e2 > -dy) {
                    err = err - dy;
                    x0 = x0 + sx;
                }
                else if(e2 < dx) {
                    err = err + dx;
                    y0 = y0 + sy;
                }            
            }
        }

        return plotList;
    }
}