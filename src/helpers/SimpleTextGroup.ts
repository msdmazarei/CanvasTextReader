import { ITextGroup, ETextType, EDirection, ITextFormat, IText, IParagraph } from "./IBook";

export class SimpleTextGroup implements ITextGroup {
    paragraph: IParagraph
    async get_first(): Promise<IText<any>> {
        if((this._txts||[]).length>0) return this._txts[0];
    }

    type: ETextType;
    direction?: EDirection;
    format?: ITextFormat;
    _txts: Array<IText<any>>;
    constructor(txts: Array<IText<any>>, type: ETextType, direction: EDirection, format: ITextFormat) {
        this._txts = txts
        this.type = type;
        this.direction = direction
        this.format = format
    }
    async get_texts(): Promise<IText<any>[]> {
        return this._txts;
    }
    async get_length(): Promise<number> {
        return this._txts.length;
    }
    async split_to_index(toIndex: number): Promise<ITextGroup[]> {
        const txts = this._txts
        const fisrt_texts = txts.slice(0, toIndex)
        const second_texts = txts.slice(toIndex, txts.length)
        const fisrt_g: ITextGroup = new SimpleTextGroup(fisrt_texts,
            ETextType.TXTGROUP,
            this.direction,
            this.format)
        const second_g: ITextGroup = new SimpleTextGroup(second_texts,
            ETextType.TXTGROUP,
            this.direction,
            this.format)
        return [fisrt_g, second_g]
    }



}