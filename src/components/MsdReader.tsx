import React, { Component } from 'react';
import { IBook, EDirection, IText, ITextGroup, ISerialRendererItemProvider, ETextType, ITextFormat } from '../helpers/IBook'
import { stat } from 'fs';
import * as ZingTouch from 'zingtouch'
import { fontMetrics } from '../utils/fontMetrics';
import { IMargin } from '../helpers/IMargin';
import { IGeoSize } from '../helpers/IGeoSize';
import { IReaderStyle } from '../helpers/IReaderStyle';
import { TextHelpers } from '../helpers/text_helpers';
import { IFormat } from '../helpers/IFormat';
import { Font, loadSync, load } from 'opentype.js'

interface IProps {
    zoom?: number
    btwLineSpace: number,
    width: number,
    height: number,
    ItemProvder: ISerialRendererItemProvider,
    VWordSpace: number,
    margin: IMargin,
    readerStyle: IReaderStyle
}
interface IBBox {
    x: number,
    y: number,
    x_end: number,
    y_end: number
}
interface IState {
    to_render: Array<IText<any> | ITextGroup>
    rendered: Array<IText<any>>
    rendered_bbox: Array<IBBox>,
    lines_wordsbbox: Array<Array<{ item: IText<any>, bbox: IBBox }>>

}

export class MsdReader extends Component<IProps, IState> {
    canvasref: any;
    canvasCTX: any;
    defaultFont: string = "Far_Mitra";
    defaultFontSize: string = "16";

    constructor(props: IProps) {
        super(props);
        this.canvasref = React.createRef();
        this.state = {
            to_render: [],
            rendered: [],
            rendered_bbox: [],
            lines_wordsbbox: []
        }

    }
    zFontSize(fontSize: string, is_zoomable): string {
        //        (this.props.zoom || 1) * fontSize 
        return fontSize
    }
    vertical_space_px(): number {
        const { VWordSpace, zoom } = this.props
        return VWordSpace * (zoom ? zoom : 1)
    }

    async check_render_item_into_width_possiblity(item: IText<string> | IText<ImageData>, width: number, envFormat: IFormat): Promise<{
        renderable: IText<any>,
        remain: IText<any>,
        consume_size: IGeoSize
    }> {
        // debugger;
        if (item.type == ETextType.NEW_LINE) return { renderable: item, remain: null, consume_size: { height: 0, width: 0 } }
        if (item.type == ETextType.NEW_PAGE) return { renderable: null, remain: item, consume_size: null }

        const t = item as IText<string> | IText<ImageData>
        const geosize = TextHelpers.simple_text_geo_size(t, envFormat)
        if (geosize.width < width)
            return { renderable: t, remain: null, consume_size: geosize }
        else
            return { renderable: null, remain: t, consume_size: null }

    }
    get_line_words_order(line: Array<IText<any>>): Array<IText<any>> {
        let rtn = []
        if (line.length > 0) {
            debugger;
            const firstword = line[0]
            const line_direction = firstword.paragraph.direction ||
                firstword.paragraph.chapter.direction ||
                firstword.paragraph.chapter.book.direction ||
                EDirection.rtl
            let group_items = []
            for (let item of line) {
                if (item.text_group) {
                    if (item.text_group.direction != line_direction) {
                        group_items.push(item)
                    }
                } else {
                    if (group_items.length > 0) {
                        rtn.push(...group_items.reverse())
                        group_items = []
                    }
                    rtn.push(item)
                }
            }
            rtn.push(...group_items.reverse())
            return rtn


        }
    }
    async need_space(f: IText<any> | ITextGroup, s: IText<any> | ITextGroup): Promise<boolean> {
        if (f == null || s == null) return false;
        if (s.type == ETextType.PUNCTUATION || s.type == ETextType.NEW_LINE || s.type == ETextType.NEW_PAGE) return false;
        return true;
    }
    async get_a_line(
        fetch_function: () => Promise<IText<any>>,
        undo_fetch: () => Promise<any>,
        envFormat: IFormat): Promise<{
            line: Array<IText<any>>,
            remains_out_of_line: Array<IText<any> | ITextGroup>
        }> {
        // debugger;
        const { width, margin } = this.props
        const line_length_px = width - (margin.left || 0) - (margin.right || 0)
        let available_line_space = line_length_px;
        const line_parts: Array<IText<any>> = []
        const vertical_word_space = this.vertical_space_px()
        let lastWord: IText<any> = null
        let currentWord: IText<any> = null
        while (true) {
            const item = await fetch_function()
            if (item == null) {
                if (line_parts.length == 0) return { line: null, remains_out_of_line: null };
                else return { line: line_parts, remains_out_of_line: null }
            }

            if (item.type == ETextType.NEW_LINE) {
                line_parts.push(item)
                return { line: line_parts, remains_out_of_line: null }
            }
            const { renderable, remain, consume_size } = await this.check_render_item_into_width_possiblity(item, available_line_space, envFormat)
            if (remain != null) {
                await undo_fetch()

                //line has no space or not allowed to contains more Item
                return { line: line_parts, remains_out_of_line: [] }

            } else {
                if (renderable != null) {
                    available_line_space -= consume_size.width
                    const need_space = await this.need_space(lastWord, currentWord)
                    lastWord = currentWord

                    if (need_space) available_line_space -= vertical_word_space

                    if (available_line_space < vertical_word_space) {
                        await undo_fetch()
                        return { line: line_parts, remains_out_of_line: [] }
                    }

                    line_parts.push(renderable)


                } else {
                    // may be we have an ITextGroup with no content. so continue
                    continue
                }
            }
        }
    }

    async get_page_content(forward: boolean = true, envFormat: IFormat, remains: Array<IText<any> | ITextGroup>): Promise<
        {
            lines: Array<Array<IText<any> | ITextGroup>>,
            remains: Array<IText<any> | ITextGroup>
        }
    > {
        // debugger;
        let browse_function: () => Promise<IText<any>> = null;
        let undo_fetch_function: () => Promise<IText<any>> = null;
        const { width, height, margin, btwLineSpace } = this.props;

        browse_function = async () => null;

        if (forward) {
            browse_function = this.props.ItemProvder.nextTextItem.bind(this.props.ItemProvder);
            undo_fetch_function = this.props.ItemProvder.prevTextItem.bind(this.props.ItemProvder);
        } else {
            browse_function = this.props.ItemProvder.prevTextItem.bind(this.props.ItemProvder);
            undo_fetch_function = this.props.ItemProvder.nextTextItem.bind(this.props.ItemProvder);
        }

        let lines: Array<Array<IText<any> | ITextGroup>> = [];
        let available_height = height - (margin.top || 0) - (margin.bottom || 0);

        let item = await browse_function()



        if (item.type != ETextType.NEW_PAGE) {

            await undo_fetch_function()
        }

        while (true) {
            debugger;
            let { line } = await this.get_a_line(browse_function, undo_fetch_function, envFormat)

            if (line == null) {
                return {
                    lines: lines,
                    remains: []
                }
            } else {
                const heights = line.map(x => {
                    const format = { ...x.envFormat, ...x.format } as IFormat
                    const gsize = TextHelpers.simple_text_geo_size(x, format);
                    if (gsize == null)
                        return 0
                    else
                        return gsize.height
                }
                )
                const max_height = Math.max(...heights)
                if (available_height - max_height - btwLineSpace > 0) {
                    available_height -= max_height
                    available_height -= btwLineSpace
                    lines.push(line)
                }
                else {
                    return {
                        lines: lines,
                        remains: []
                    }
                }

            }

        }

    }
    async render_line(x: number, y: number, line: Array<IText<any>>, dir: EDirection): Promise<{ max_height: number, words_bbox: Array<{ bbox: IBBox, item: IText<any> }> }> {

        const { readerStyle } = this.props
        line = this.get_line_words_order(line)
        const words_bbox: Array<{ bbox: IBBox, item: IText<any> }> = []
        const geo_sizes = line.map(x => TextHelpers.simple_text_geo_size(x, readerStyle as IFormat))
        const max_height = Math.max.apply(null, geo_sizes.map(x => x ? x.height : 0))
        let direction_sign = 1;
        if (dir == EDirection.rtl) {
            direction_sign = -1;
        }
        console.log(line.map(x => x.get_content()).join(" "))
        for (let i = 0; i < line.length; i++) {

            const item = line[i]
            const item_size = geo_sizes[i]
            if (item_size == null) continue;
            let corrected_y = y

            if (item_size.height != max_height) {
                corrected_y = y + (max_height - item_size.height) / 2
            }
            if (item.type == ETextType.PUNCTUATION || item.type == ETextType.TXT) {
                const item_format = { ...readerStyle, ...(item.envFormat || {}), ...(item.format || {}) } as IFormat
                const item_image = fontMetrics.get_text_image(item_format, (item as IText<string>).get_content())
                debugger;
                if (direction_sign < 0) x = x + item_image.width * direction_sign
                this.canvasCTX.putImageData(item_image, x, corrected_y)
                const wordbbox: IBBox = { x: x, y: corrected_y, x_end: x + item_image.width, y_end: corrected_y + item_image.height }
                words_bbox.push({ bbox: wordbbox, item: item })
                if (i + 1 < line.length) {
                    const next_item = line[i + 1]
                    const need_space = await this.need_space(item, next_item)
                    if (need_space) x = x + this.vertical_space_px() * direction_sign
                }

            }

        }

        return { max_height: max_height, words_bbox: words_bbox }
    }
    async componentDidMount() {
        await fontMetrics.load_system_fonts()

        debugger;

        const canvasNode = this.canvasref.current;
        const canvasParent = canvasNode.parentNode;

        var activeRegion = ZingTouch.Region(canvasParent);

        var that = this;
        activeRegion.bind(canvasNode, 'swipe', function (event) {
            alert("you swiped")
            that.setState({ ...this.state, event: JSON.stringify(event.detail.data) })

        })
        const ctx = this.canvasCTX = this.canvasref.current.getContext("2d")
        // this.canvas_render();
        const new_state = {};
        await this.render_next_page();
        // load("/Far_Mitra.ttf", (err, font) => {
        //     debugger;
        //     console.log(err);
        //     console.log(font);
        //     const txt = "سلام"
        //     const path = font.getPath(txt, 0, 0, 72)
        //     const bbox = path.getBoundingBox()
        //     const width = bbox.x2-bbox.x1
        //     const height = bbox.y2- bbox.y1
        //     font.draw(ctx, txt, width,height,72)
        //     debugger;
        // })




    }
    async render_next_page() {
        const { to_render } = this.state
        let lines_wordsbbox: Array<Array<{ item: IText<any>, bbox: IBBox }>> = []
        const PT = await this.get_page_content(true, this.props.readerStyle as IFormat, to_render || [])
        let line_x_start_px = this.props.width - (this.props.margin.right || 0)
        let line_y_start_px = this.props.margin.top || 0
        for (let line of PT.lines) {
            const { max_height, words_bbox } = await this.render_line(line_x_start_px, line_y_start_px, line as Array<IText<any>>, EDirection.rtl)
            lines_wordsbbox.push(words_bbox)
            line_y_start_px += max_height + (this.props.btwLineSpace)
        }
        this.setState({ ...this.state, to_render: PT.remains, lines_wordsbbox: lines_wordsbbox })

    }
    async canvas_render() {
        const canvasNode = this.canvasref.current;
        const ctx = canvasNode.getContext('2d');

        ctx.fillStyle = 'green';
        ctx.fillRect(0, 0, this.props.width, this.props.height);

    }

    onClick(evt) {
        var rect = this.canvasref.current.getBoundingClientRect()
        const { x, y } = {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
        let msg: string = "clientX: " + x +
            " - clientY: " + y;
        const { lines_wordsbbox } = this.state
        let seletced_item: IText<any>;
        for (const line of lines_wordsbbox) {
            for (const item of line) {
                if (x >= item.bbox.x && x <= item.bbox.x_end && y >= item.bbox.y && y <= item.bbox.y_end) {
                    seletced_item = item.item
                    break
                }
            }
        }
        if (seletced_item) {
            const final_format = { ...this.props.readerStyle, ... (seletced_item.envFormat || {}), ...(seletced_item.format || {}) } as IFormat
            final_format.backgroundColor = { blue: 255, green: 0, red: 0, alpha: 1 }
            const img = fontMetrics.get_text_image(final_format, seletced_item.get_content())
        }
    }
    render() {
        const { width, height } = this.props;

        return (
            <div>

                <canvas width={width} height={height} ref={this.canvasref} onClick={this.onClick.bind(this)} >
                    Your Device not Support Our features.
            </canvas>
                <div style={{ width: "100px" }}>
                    <p style={{ fontSize: "x-small", textAlign: "left" }}></p>

                </div>
            </div >
        )
    }
}
