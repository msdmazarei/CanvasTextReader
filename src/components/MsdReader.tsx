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
import { number } from 'prop-types';
import { Z_NO_COMPRESSION } from 'zlib';

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
    lines_bbox: Array<IBBox>,
    selected: {
        first_line_index: number,
        last_line_index: number,
        full_line_selected_indices: Array<number>,
        first_line_selected_words: Array<number>,
        last_line_selected_words: Array<number>
    },
    page_lines: Array<Array<IText<any> | ITextGroup>>,
    page_start_state: any,
    zoom: number

}

export class MsdReader extends Component<IProps, IState> {
    canvasref: any;
    canvasCTX: any;
    defaultFont: string = "Far_Mitra";
    defaultFontSize: string = "16";
    canvasRect: any;

    constructor(props: IProps) {
        super(props);
        this.canvasref = React.createRef();
        this.state = {
            to_render: [],
            rendered: [],
            rendered_bbox: [],
            lines_wordsbbox: [],
            lines_bbox: [],
            page_lines: [],
            selected: {
                first_line_index: -1,
                last_line_index: -1,
                full_line_selected_indices: [],
                first_line_selected_words: [],
                last_line_selected_words: []
            },
            page_start_state: null,
            zoom: this.props.zoom
        }

    }
    zFontSize(fontSize: number, is_zoomable): number {
        return (this.props.zoom || 1) * fontSize
    }
    horizantal_space_px(): number {
        const { VWordSpace, zoom } = this.props
        return VWordSpace * (zoom ? zoom : 1)
    }
    vertical_space_px(): number {
        const { zoom, btwLineSpace } = this.props
        return btwLineSpace * (zoom != null ? zoom : 1)
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
        const { width, margin } = this.props
        const line_length_px = width - (margin.left || 0) - (margin.right || 0)
        let available_line_space = line_length_px;
        const line_parts: Array<IText<any>> = []
        const h_word_space = this.horizantal_space_px()
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

                    if (need_space) available_line_space -= h_word_space


                    if (available_line_space < h_word_space) {
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
        const { width, height, margin } = this.props;
        const btwLineSpace = this.vertical_space_px()
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
            let { line } = await this.get_a_line(browse_function, undo_fetch_function, envFormat)

            if (line == null) {
                return {
                    lines: lines,
                    remains: []
                }
            } else {
                const heights = line.map(x => {
                    const format = { ...envFormat, ...x.envFormat, ...x.format } as IFormat
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
    item_format(item: IText<any> | IText<ImageData>): IFormat {
        const { readerStyle } = this.props
        const item_format = { ...readerStyle, ...(item.envFormat || {}), ...(item.format || {}) } as IFormat
        item_format.fontSize = this.zFontSize(item_format.fontSize, this.state.zoom)


        return item_format
    }
    item_image(item: IText<any> | IText<ImageData>): { image: ImageData, base_line: number } {
        const item_image = fontMetrics.get_text_image(this.item_format(item), (item as IText<string>).get_content())
        return item_image
    }
    async render_line(x: number, y: number, line: Array<IText<any>>, dir: EDirection): Promise<{ max_height: number, words_bbox: Array<{ bbox: IBBox, item: IText<any> }> }> {
        debugger;
        const { readerStyle } = this.props
        line = this.get_line_words_order(line)
        const words_bbox: Array<{ bbox: IBBox, item: IText<any> }> = []
        const geo_sizes = line.map(x => TextHelpers.simple_text_geo_size(x, readerStyle as IFormat))
        const max_height = Math.max.apply(null, geo_sizes.map(x => x ? x.height : 0))
        let direction_sign = 1;
        if (dir == EDirection.rtl) {
            direction_sign = -1;
        }
        for (let i = 0; i < line.length; i++) {

            const item = line[i]
            const item_size = geo_sizes[i]
            if (item_size == null) continue;
            let corrected_y = y

            if (item_size.height != max_height) {
                corrected_y = y + (max_height - item_size.height) / 2
            }
            if (item.type == ETextType.PUNCTUATION || item.type == ETextType.TXT) {
                const { image, base_line } = this.item_image(item)
                const item_image = image
                corrected_y = corrected_y + (item_size.height / 2 - base_line)
                if (direction_sign < 0) x = x + item_image.width * direction_sign
                this.canvasCTX.putImageData(item_image, x, corrected_y)
                const wordbbox: IBBox = { x: x, y: corrected_y, x_end: x + item_image.width, y_end: corrected_y + item_image.height }
                words_bbox.push({ bbox: wordbbox, item: item })
                if (i + 1 < line.length) {
                    const next_item = line[i + 1]
                    const need_space = await this.need_space(item, next_item)
                    if (need_space) {
                        // if ((item.format || {}).selected) {
                        //     this.canvasCTX.rect(x, y, this.horizantal_space_px() * direction_sign, max_height)
                        //     this.canvasCTX.fillStyle = "#0000FF"
                        //     this.canvasCTX.fill();
                        // }
                        // if ((item.format || {}).selected != true) {
                        //     this.canvasCTX.rect(x, y, this.horizantal_space_px() * direction_sign, max_height)
                        //     this.canvasCTX.fillStyle = "#FFFFFF"
                        //     this.canvasCTX.fill();
                        // }

                        x = x + this.horizantal_space_px() * direction_sign

                    }
                }

            }

        }

        return { max_height: max_height, words_bbox: words_bbox }
    }
    async componentDidMount() {
        await fontMetrics.load_system_fonts()


        const canvasNode = this.canvasref.current;
        const canvasParent = canvasNode.parentNode;

        this.canvasRect = this.canvasref.current.getBoundingClientRect()
        var activeRegion = ZingTouch.Region(canvasParent);

        var that = this;
        // activeRegion.bind(canvasNode, 'swipe', function (event) {
        //     alert("you swiped")
        //     that.setState({ ...this.state, event: JSON.stringify(event.detail.data) })

        // })
        const ctx = this.canvasCTX = this.canvasref.current.getContext("2d")
        // this.canvas_render();
        const new_state = {};
        this.setState({ ...this.state, page_start_state: await this.props.ItemProvder.get_state() })
        await this.render_next_page();





    }

    async  render_page(lines: Array<Array<IText<any> | ITextGroup>>): Promise<{
        lines_bbox: Array<IBBox>,
        lines_wordsbbox: Array<Array<{ item: IText<any>, bbox: IBBox }>>
    }> {
        const { height, width, margin } = this.props
        const { selected } = this.state
        let line_x_start_px = width - (margin.right || 0)
        let line_y_start_px = margin.top || 0
        const lines_bbox: Array<IBBox> = [];
        let lines_wordsbbox: Array<Array<{ item: IText<any>, bbox: IBBox }>> = []
        let line_counter = -1
        for (let line of lines) {
            line_counter++;

            const line_bbox: IBBox = {
                x: line_x_start_px,
                y: line_y_start_px,
                x_end: this.props.width - line_x_start_px,
                y_end: -1
            }
            if (line_y_start_px > height) {
                debugger;
            }
            if (selected.full_line_selected_indices.indexOf(line_counter) > -1) {
                line.forEach(x => {
                    x.format = { ...(x.format || {}), selected: true }
                })
            } else if (selected.first_line_index == line_counter) {
                for (let wi = 0; wi < line.length; wi++) {
                    if (selected.first_line_selected_words.indexOf(wi) > -1) {
                        let x = line[wi]
                        x.format = { ...(x.format || {}), selected: true }
                    }
                }

            } else if (selected.last_line_index == line_counter) {
                for (let wi = 0; wi < line.length; wi++) {
                    if (selected.last_line_selected_words.indexOf(wi) > -1) {
                        let x = line[wi]
                        x.format = { ...(x.format || {}), selected: true }
                    }
                }
            }
            else {
                line.forEach(x => {
                    x.format = { ...(x.format || {}), selected: false }
                })
            }
            const { max_height, words_bbox } = await this.render_line(line_x_start_px, line_y_start_px, line as Array<IText<any>>, EDirection.rtl)
            lines_wordsbbox.push(words_bbox)
            line_bbox.y_end = line_y_start_px + max_height
            lines_bbox.push(line_bbox)
            line_y_start_px += max_height + this.vertical_space_px()
        }
        return { lines_bbox, lines_wordsbbox }
    }
    clear_page() {
        const { width, height } = this.props
        this.canvasCTX.clearRect(0, 0, width, height)
    }
    async render_next_page() {
        this.clear_page();
        const { to_render } = this.state
        const envFormat = {...this.props.readerStyle, fontSize: this.zFontSize(this.props.readerStyle.fontSize,this.props.zoom)}
        const PT = await this.get_page_content(true, envFormat as IFormat, to_render || [])
        const { lines_wordsbbox, lines_bbox } = await this.render_page(PT.lines)
        this.setState({
            ...this.state,
            to_render: PT.remains,
            lines_wordsbbox: lines_wordsbbox,

            lines_bbox: lines_bbox, page_lines: PT.lines
        })

    }
    async canvas_render() {
        const canvasNode = this.canvasref.current;
        const ctx = canvasNode.getContext('2d');

        ctx.fillStyle = 'green';
        ctx.fillRect(0, 0, this.props.width, this.props.height);

    }

    onClick(evt) {
        return;

        var rect = this.canvasRect
        const { x, y } = {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
        const { lines_bbox, lines_wordsbbox, } = this.state

        let target_line_index: number = null
        for (let li = 0; li < lines_bbox.length; li++) {
            const lbb = lines_bbox[li]
            if (y > lbb.y && y < lbb.y_end) {
                target_line_index = li
                break;
            }
        }
        if (target_line_index != null) {
            const words = lines_wordsbbox[target_line_index]
            let seletced_item: { item: IText<any>, bbox: IBBox } = null
            for (let wi = 0; wi < words.length; wi++) {
                const wbb = words[wi]
                const xmax = Math.max(wbb.bbox.x, wbb.bbox.x_end)
                const xmin = Math.min(wbb.bbox.x, wbb.bbox.x_end)

                if (x >= xmin && x <= xmax) {
                    seletced_item = wbb;
                    break;
                }
            }
            if (seletced_item != null) {
                const selected_status = (seletced_item.item.format || {}).selected || false;
                seletced_item.item.format = ({ ... (seletced_item.item.format || {}), selected: !selected_status }) as ITextFormat
                const txtimg = this.item_image(seletced_item.item)
                this.canvasCTX.putImageData(txtimg, seletced_item.bbox.x, seletced_item.bbox.y)
            }
        } else {
            console.log("out of lines")
        }

        return;
        let msg: string = "clientX: " + x +
            " - clientY: " + y;
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

    get_line_index_by_y(y: number): number {
        const { lines_bbox } = this.state
        for (let i = 0; i < lines_bbox.length; i++) {
            const lbb = lines_bbox[i]
            const max = Math.max(lbb.y, lbb.y_end)
            const min = Math.min(lbb.y, lbb.y_end)
            if (min > y) return i;
            if (max > y) return i;
        }
        return null
    }
    item_direction(item: IText<any> | IText<ImageData>): EDirection {
        const dir = item.paragraph.direction || item.paragraph.chapter.direction || item.paragraph.chapter.book.direction || EDirection.rtl
        return dir
    }
    select_bbox(x_start: number, y_start: number, x_end: number, y_end: number): {
        full_line_selected_indices: Array<number>,
        first_line_selected_words: Array<number>,
        last_line_selected_words: Array<number>,
        first_line_index: number,
        last_line_index: number

    } {
        const { width, height } = this.props
        const y_min = Math.min(y_start, y_end)
        const y_max = Math.max(y_start, y_end)
        const corrected_y_min = Math.max(0, y_min)
        const corrected_y_max = Math.min(height, y_max)
        const first_selected_line = this.get_line_index_by_y(corrected_y_min)
        const last_selected_line = this.get_line_index_by_y(corrected_y_max)
        const full_line_selected_indices = []

        const { lines_wordsbbox } = this.state


        for (let i = first_selected_line + 1; i < last_selected_line; i++) full_line_selected_indices.push(i)

        const first_line_words = lines_wordsbbox[first_selected_line]
        const first_line_selected_words = []
        const last_line_words = lines_wordsbbox[last_selected_line]
        const last_line_selected_words = []
        if (last_selected_line > first_selected_line) {
            let x_of_first_line: number
            let x_of_last_line: number
            if (y_min == y_start) { x_of_first_line = x_start; x_of_last_line = x_end }
            else { x_of_first_line = x_end; x_of_last_line = x_start }

            //select words of first line( from x_of_last_line to end)
            if (first_line_words.length > 0) {
                for (let i = 0; i < first_line_words.length; i++) {
                    const [wx, wx_end] = [first_line_words[i].bbox.x, first_line_words[i].bbox.x_end]
                    const wxmin = Math.min(wx, wx_end)
                    const wxmax = Math.max(wx, wx_end)
                    if (x_of_first_line >= wxmin && x_of_first_line <= wxmax) {
                        //selet till end of line
                        for (let j = i; j < first_line_words.length; j++) first_line_selected_words.push(j)
                        break
                    }
                }
            }

            //select words of last line(from start to x_of_last_line)
            for (let i = 0; i < last_line_words.length; i++) {
                const [wx, wx_end] = [last_line_words[i].bbox.x, last_line_words[i].bbox.x_end]
                const wxmin = Math.min(wx, wx_end)
                if (last_line_words.length > 0) {
                    const first_word_dir = this.item_direction(last_line_words[0].item)
                    const sign_of_direction = first_word_dir == EDirection.ltr ? 1 : -1
                    if (x_of_last_line * sign_of_direction > sign_of_direction * wxmin) {
                        last_line_selected_words.push(i)
                    }
                }

            }



        } else
            if (last_selected_line == first_selected_line) {

                const xmin = Math.min(x_start, x_end)
                const xmax = Math.max(x_start, x_end)
                for (let i = 0; i < first_line_words.length; i++) {
                    const wbb = first_line_words[i].bbox
                    if ((xmax >= wbb.x && wbb.x >= xmin) ||
                        (xmax >= wbb.x_end && wbb.x >= xmin)) first_line_selected_words.push(i)
                }
            }



        return {
            first_line_index: first_selected_line,
            last_line_index: last_selected_line,
            full_line_selected_indices,
            first_line_selected_words,
            last_line_selected_words
        }


    }

    user_is_dragging = false
    drag_start_xy = null
    drag_end_xy = null
    mouseDown(evt) {
        var rect = this.canvasRect
        const { x, y } = {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
        this.user_is_dragging = true
        this.drag_start_xy = { x, y }
    }
    mouseMove(evt) {
        if (this.user_is_dragging) {
            var rect = this.canvasRect
            const { x, y } = {
                x: evt.clientX - rect.left,
                y: evt.clientY - rect.top
            };
            this.drag_end_xy = { x, y }
            const selected_parts = this.select_bbox(this.drag_start_xy.x, this.drag_start_xy.y, this.drag_end_xy.x, this.drag_end_xy.y);

            this.setState({ ...this.state, selected: selected_parts })

        }

    }
    mouseUp(evt) {
        if (this.user_is_dragging) {
            var rect = this.canvasRect
            const { x, y } = {
                x: evt.clientX - rect.left,
                y: evt.clientY - rect.top
            };
            this.user_is_dragging = false
            this.drag_end_xy = { x, y }
            console.log("drag ende, selected region:", this.drag_start_xy, "end:", this.drag_end_xy)
            const selected_parts = this.select_bbox(this.drag_start_xy.x, this.drag_start_xy.y, this.drag_end_xy.x, this.drag_end_xy.y);

            this.setState({ ...this.state, selected: selected_parts })

        }

    }
    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.props.zoom != prevState.zoom) {
            debugger;
            if (this.state.page_start_state) {

                this.props.ItemProvder.set_state(this.state.page_start_state)
                this.setState({ zoom: this.props.zoom, page_lines: [] })
                this.render_next_page()

            }
        }
    }
    render() {
        debugger;
        const { width, height, zoom } = this.props;
        const { page_lines } = this.state

        if (page_lines.length > 0 && (this.props.zoom == this.state.zoom)) {
            this.render_page(page_lines)
        }

        return (
            <div>

                <canvas width={width} height={height} ref={this.canvasref}
                    onClick={this.onClick.bind(this)}
                    onMouseDown={this.mouseDown.bind(this)}
                    onMouseMove={this.mouseMove.bind(this)}
                    onMouseUp={this.mouseUp.bind(this)}
                >
                    Your Device not Support Our features.
            </canvas>
                <div style={{ width: "100px" }}>
                    <p style={{ fontSize: "x-small", textAlign: "left" }}></p>

                </div>
            </div >
        )
    }
}
