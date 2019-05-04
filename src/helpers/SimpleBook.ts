import { IBook, EDirection, IBookChapter, ITextGroup, IChapter, ETextType, ITextFormat, IText, IParagraph } from "./IBook";
import { number } from "prop-types";
import { IFormat } from "./IFormat";
export class SimpleText<T> implements IText<T> {
    paragraph: IParagraph;
    text_group?: ITextGroup;
    index_in_group?: number;
    _content: T
    constructor(content: T) {
        this._content = content
        if (typeof (content) == "string") {
            this.type = ETextType.TXT;
            if (content == "\n") this.type = ETextType.NEW_LINE
            if (".,;: ".indexOf(content) > -1) this.type = ETextType.PUNCTUATION
        } else {
            this.type = ETextType.IMG
        }

    }
    type: ETextType;
    get_content(): T {
        return this._content
    }
    format?: ITextFormat;
    envFormat?: IFormat;
    static from_string(s: string): IText<string> {
        return new SimpleText<string>(s)
    }


}
export class SimpleTextGroup implements ITextGroup {
    paragraph: IParagraph;
    type: ETextType;
    direction?: EDirection;
    format?: ITextFormat;
    envFormat?: IFormat;
    _txts: IText<any>[];
    constructor(texts: Array<IText<any>>, dir: EDirection, format: ITextFormat) {
        this.type = ETextType.TXTGROUP
        this.direction = dir
        this.format = format
        for (let t in texts.keys()) { texts[t].text_group = this; texts[t].index_in_group = t }
        this._txts = texts
    }
    async  get_texts(): Promise<IText<any>[]> {
        const rtn  =  this._txts;
        for(let i of rtn) {
            i.text_group =this
            i.paragraph = this.paragraph
        }
        return rtn
    }
    async  get_length(): Promise<number> {
        return (this._txts || []).length
    }
    async split_to_index(toIndex: number): Promise<ITextGroup[]> {
        const f = this._txts.slice(0, toIndex - 1)
        const s = this._txts.slice(toIndex, this._txts.length)
        return [new SimpleTextGroup(f, this.direction, this.format),
        new SimpleTextGroup(s, this.direction, this.format)]
    }
    async get_first(): Promise<IText<any>> {
        return this._txts[0]
    }


}
export class SimpleParagraph implements IParagraph {
    chapter: IChapter;
    _flatten_len: number;
    async get_flatten_length(): Promise<number> {
        if (this._flatten_len != null) return this._flatten_len;
        let count = 0;
        for (let t of this._txts) {
            if (t.type == ETextType.TXTGROUP) count += await (t as ITextGroup).get_length()
            else count += 1
        }
        this._flatten_len = count;
        return this._flatten_len;
    }
    direction?: EDirection; format?: ITextFormat;
    envFormat?: IFormat;
    _txts: Array<IText<any> | ITextGroup>;
    constructor(dir: EDirection, format: ITextFormat, texts: Array<IText<any> | ITextGroup>) {
        this.direction = dir;
        this.format = format;
        for (let t of texts) t.paragraph = this;
        this._txts = texts;
    }
    async get_texts(): Promise<(ITextGroup | IText<any>)[]> {
        return this._txts;
    }

    async get_text(i: number): Promise<ITextGroup | IText<any>> {
        if (i > this._txts.length) return null;
        const rtn = this._txts[i]
        rtn.paragraph = this
        return rtn;
    }
    async get_length(): Promise<number> {
        return this._txts.length;
    }

    static from_string(s: string, dir: EDirection): SimpleParagraph {
        let word: string = null;
        let items: Array<IText<string>> = [];
        const puncs = ".,،;\n"
        for (let i = 0; i < s.length; i++) {
            const ch = s.charAt(i)
            if (ch == " " || puncs.indexOf(ch) > -1) {
                if ((word || "") != "") { items.push(SimpleText.from_string(word)); word = null; }
                if (puncs.indexOf(ch) > -1)
                    items.push(SimpleText.from_string(ch))
            } else word = (word || "") + ch
        }
        if (word != null) items.push(SimpleText.from_string(word))
        return new SimpleParagraph(dir, null, items)
    }
    async insert_head(item: IText<any> | ITextGroup) {
        this._txts = [item, ...this._txts]
    }

}
export class SimpleChapter implements IChapter {
    book: IBook;
    direction?: EDirection; format?: ITextFormat;
    _paras: Array<IParagraph>;
    _tit: IParagraph
    constructor(dir: EDirection, format: ITextFormat, paragraphs: Array<IParagraph>) {
        this.format = format
        this.direction = dir
        for (let p of paragraphs) p.chapter = this;
        this._paras = paragraphs
    }
    async get_title(): Promise<IParagraph> {
        return this._tit;
    }
    async get_paragraphs(): Promise<IParagraph[]> {
        return this._paras;
    }
    async get_paragraph(i: number): Promise<IParagraph> {
        if (i < 0 || i > this._paras.length) return null;
        const rtn = this._paras[i]
        rtn.chapter = this;
        return rtn
    }
    async get_length(): Promise<number> {
        return this._paras.length;
    }


}
export class SimpleBook implements IBook {
    direction: EDirection;
    _chaps: Array<IChapter>
    constructor(chapters: Array<IChapter>) {
        this._chaps = chapters
    }

    async get_chapters(): Promise<IChapter[]> {
        return this._chaps
    }
    async get_chapter(i: number): Promise<IChapter> {
        if (i < 0 || i > this._chaps.length) return null
        const rtn = this._chaps[i]
        rtn.book= this;
        return rtn
    }
    async get_length(): Promise<number> {
        return this._chaps.length
    }


}