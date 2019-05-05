import { ITextFormat } from "../helpers/IBook";
import { IReaderStyle } from "../helpers/IReaderStyle";
import { IFormat } from "../helpers/IFormat";
import { load, Font, BoundingBox } from 'opentype.js';
export class fontMetrics {
    static tempCanvasContext: any = null;
    static dummy_elemnt: any = null;
    static cache: Map<string, ImageData> = new Map();
    static cache_size: number = 1000;
    static loaded_font: Map<string, Font> = new Map();
    static fontBboxCache: Map<string, BoundingBox> = new Map()
    static fontBboxCahce_size = 10000;

    static format2str(format: IFormat): string {
        const b = format.bold ? "B" : "b"
        const i = format.italic ? "I" : "i"
        const u = format.underlined ? "U" : "u"
        const z = format.zoomable ? "Z" : "z"
        const c = format.color ? format.color : "c"
        return `${b}${i}${u}${z}${c}`
    }


    static async load_font(fontname): Promise<Font> {
        return new Promise((res, rej) => {
            load(`/${fontname}`, (err, font) => {
                if (err) {
                    rej(err)
                }
                if (font) {
                    fontMetrics.loaded_font.set(fontname, font)
                    res(font)
                }
            })
        })
    }
    static async load_system_fonts(): Promise<Array<Font>> {
        const font_names = ["Far_Mitra", "Tahoma"]
        const promises = font_names.map(x => fontMetrics.load_font(x))
        return await Promise.all(promises)
    }
    static get_font(fontname): Font {
        if (fontMetrics.loaded_font.has(fontname)) return fontMetrics.loaded_font.get(fontname)
        const first_key = fontMetrics.loaded_font.keys().next().value

        return fontMetrics.loaded_font.get(first_key)
    }

    static get_text_bbox(format: IFormat, text: string): BoundingBox {
        const cache_key = fontMetrics.format2str(format) + "-" + text
        if (fontMetrics.fontBboxCache.has(cache_key)) return fontMetrics.fontBboxCache.get(cache_key)

        const fontname = format.fontFamily
        const font: Font = fontMetrics.get_font(fontname)

        const fontSize = parseInt(format.fontSize || "18")
        const bbox_rtn = font.getPath(text, 0, 0, fontSize).getBoundingBox()
        fontMetrics.fontBboxCache.set(cache_key, bbox_rtn)
        if (fontMetrics.fontBboxCache.size > fontMetrics.fontBboxCahce_size) {
            const firtskey = fontMetrics.fontBboxCache.keys().next().value
            fontMetrics.fontBboxCache.delete(firtskey)
        }

        return bbox_rtn

    }
    static get_text_height(format: IFormat, text: string): number {
        const bbox = fontMetrics.get_text_bbox(format, text)
        return bbox.y2 - bbox.y1
    }
    static get_text_height_old(format: IFormat, text: string): number {



        const { fontSize, fontFamily } = format
        const fontStyle = format.italic ? "italic" : "normal"
        const fontWeight = format.bold ? "bold" : "normal"
        const font = `font: ${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`
        if (fontMetrics.dummy_elemnt == null) {
            var body = document.getElementsByTagName("body")[0];
            var dummyWrapper = document.createElement("div");
            dummyWrapper.setAttribute("style", "max-height: 0px;overflow: auto;");
            let dummy = document.createElement("div")
            dummyWrapper.appendChild(dummy)
            body.appendChild(dummyWrapper)
            fontMetrics.dummy_elemnt = dummy;
        }
        const dummy = fontMetrics.dummy_elemnt;
        while (dummy.firstChild) {
            dummy.removeChild(dummy.firstChild);
        }

        var dummyText = document.createTextNode(text);
        dummy.setAttribute("style", font);
        dummy.appendChild(dummyText);
        var result = dummy.scrollHeight;
        return result;
    }



    static get_text_image(format: IFormat, text: string): ImageData {
        const { fontFamily, fontSize } = format
        const formatStr = fontMetrics.format2str(format)
        const cache_key = `${fontFamily}-${fontSize}-${formatStr}-${text}`
        if (fontMetrics.cache.has(cache_key)) return fontMetrics.cache.get(cache_key);

        const canvasWidth = 500;
        const canvasHeight = 500;
        if (fontMetrics.tempCanvasContext == null) {
            //add temp canvas
            var body = document.getElementsByTagName("body")[0];
            let tempCanvas = document.createElement("canvas");
            // tempCanvas.setAttribute("style", "display: none")
            tempCanvas.setAttribute("width", `${canvasWidth}`)
            tempCanvas.setAttribute("height", `${canvasHeight}`)
            tempCanvas.setAttribute("id", "tempCanvas")
            // tempCanvas.style.display = "None"
            body.appendChild(tempCanvas)
            fontMetrics.tempCanvasContext = (tempCanvas as any).getContext("2d")
        }



        const ctx = fontMetrics.tempCanvasContext
        ctx.clearRect(0, 0, canvasWidth, canvasHeight)
        debugger;
        const font = fontMetrics.get_font(fontFamily)
        const iFontSize = parseInt(fontSize||"18")
       
        const textPath = font.getPath(text, canvasWidth/2, canvasHeight/2, iFontSize)
        textPath.draw(ctx)
        const tbb = textPath.getBoundingBox()
        console.log("word:",text,"tbb:",tbb)
        const rtn1 = ctx.getImageData(Math.floor(tbb.x1), Math.floor(tbb.y1),Math.ceil(tbb.x2-tbb.x1), Math.ceil(tbb.y2-tbb.y1))
        fontMetrics.cache.set(cache_key, rtn1)
        if (fontMetrics.cache.size > fontMetrics.cache_size) {
            const first_key = fontMetrics.cache.keys().next().value
            fontMetrics.cache.delete(first_key)
        }
        return rtn1;





        ctx.textBaseline = 'top'; // important!
        ctx.font = `${fontSize} ${fontFamily}`
        const txt_width = ctx.measureText(text).width
        const txt_height = fontMetrics.get_text_height(format, text);
        ctx.fillText(text, 0, 0);
        const rtn = ctx.getImageData(0, 0, txt_width, txt_height)
        fontMetrics.cache.set(cache_key, rtn)
        if (fontMetrics.cache.size > fontMetrics.cache_size) {
            const first_key = fontMetrics.cache.keys().next().value
            fontMetrics.cache.delete(first_key)
        }
        return rtn;

    }
}
