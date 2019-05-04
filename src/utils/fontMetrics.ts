import { ITextFormat } from "../helpers/IBook";
import { IReaderStyle } from "../helpers/IReaderStyle";
import { IFormat } from "../helpers/IFormat";

export class fontMetrics {
    static tempCanvasContext: any = null;
    static dummy_elemnt: any = null;
    static cache: Map<string, ImageData> = new Map();
    static cache_size: number = 1000;
    static format2str(format: IFormat): string {
        const b = format.bold ? "B" : "b"
        const i = format.italic ? "I" : "i"
        const u = format.underlined ? "U" : "u"
        const z = format.zoomable ? "Z" : "z"
        const c = format.color ? format.color : "c"
        return `${b}${i}${u}${z}${c}`
    }
    static get_text_height(format: IFormat, text: string): number {
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

        const canvasWidth = 1000;
        const canvasHeight = 500;
        if (fontMetrics.tempCanvasContext == null) {
            //add temp canvas
            var body = document.getElementsByTagName("body")[0];
            let tempCanvas = document.createElement("canvas");
            // tempCanvas.setAttribute("style", "display: none")
            tempCanvas.setAttribute("width", `${canvasWidth}`)
            tempCanvas.setAttribute("height", `${canvasHeight}`)
            tempCanvas.setAttribute("id", "tempCanvas")
            tempCanvas.style.display = "None"
            body.appendChild(tempCanvas)
            fontMetrics.tempCanvasContext = (tempCanvas as any).getContext("2d")
        }



        const ctx = fontMetrics.tempCanvasContext
        ctx.clearRect(0, 0, canvasWidth, canvasHeight)

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
