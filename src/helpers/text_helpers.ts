import { IText, ETextType, ITextGroup } from "./IBook";
import { IGeoSize } from "./IGeoSize";
import { fontMetrics } from "../utils/fontMetrics";
import { IReaderStyle } from "./IReaderStyle";
import { IFormat } from "./IFormat";
import { SimpleTextGroup } from "./SimpleTextGroup";

export class TextHelpers {
    static simple_texts_needs_space(first: IText<any>, second: IText<any>): boolean {
        if (first == null) return false
        if (second == null) return false
        if (second.type == ETextType.PUNCTUATION) return false;
        if (second.type == ETextType.NEW_LINE) return false;
        if (second.type == ETextType.NEW_PAGE) return false;
        return true;
    }
    static simple_text_geo_size(t: IText<string> | IText<ImageData>, envFormat: IFormat): IGeoSize {
        const t_format = t.format || {}

        const textFormat: IFormat = { ...envFormat, ...t.format } as IFormat

        switch (t.type) {
            case ETextType.IMG:
                const img = t as IText<ImageData>
                return { width: img.get_content().width, height: img.get_content().height }
            case ETextType.NEW_PAGE:
            case ETextType.NEW_LINE:
                return null;
            case ETextType.PUNCTUATION:
            case ETextType.TXT:
                const tstr = t as IText<string>
                const d = fontMetrics.get_text_image(textFormat, tstr.get_content()).image
                return { width: d.width, height: d.height }
        }
    }
    static async  text_group_item_sizes(t: ITextGroup, envFormat: IFormat): Promise<Array<IGeoSize>> {
        const t_format = t.format || {}
        const textGroupFormat = { ...envFormat, ...t_format } as IFormat

        const txts = await t.get_texts()
        return txts.map(x => {
            return TextHelpers.simple_text_geo_size(x, textGroupFormat)
        })
    }

    static async text_group_agg_sizes(t: ITextGroup, envFormat: IFormat, verticalSpaceBetweenWords: number): Promise<Array<IGeoSize>> {
        const rtn: Array<IGeoSize> = []
        const itemSizes = await TextHelpers.text_group_item_sizes(t, envFormat)
        const txts = await t.get_texts()

        let total_width = 0;
        let max_height = 0;
        const first_item_size = itemSizes[0]
        if (first_item_size == null) return rtn;
        else rtn.push(first_item_size)
        let old_txt = txts[0]

        total_width = first_item_size.width
        max_height = first_item_size.height

        for (let i = 1; i < itemSizes.length; i++) {
            let new_txt = txts[i]
            let new_size = itemSizes[i]
            if (new_size == null) break

            const needs_space = TextHelpers.simple_texts_needs_space(old_txt, new_txt)

            total_width += new_size.width
            max_height = Math.max(max_height, new_size.height)

            if (needs_space) {
                total_width += verticalSpaceBetweenWords
            }
            rtn.push({ width: total_width, height: max_height })

        }
        return rtn
    }

    static async flatten(arr: Array<IText<any> | ITextGroup>, envFormat: IFormat): Promise<Array<IText<any>>> {
        let rtn = [];
        for (let r of arr) {
            if (r.type == ETextType.TXTGROUP) {
                const group_format = {}//{ ...envFormat, ...r.envFormat, ...r.format }
                const items = await (r as ITextGroup).get_texts()
                for (let i = 0; i < items.length; i++) {
                    items[i].envFormat = group_format as IFormat
                }
                rtn.push(...items)


            } else {
                const c = r as IText<any>
                c.envFormat = envFormat
                rtn.push(c)
            }
        }
        return rtn
    }

}