import { format } from "url";
import { nextTick } from "q";
import { IFormat } from "./IFormat";

export enum EDirection {
    rtl=10,
    ltr=20
}
export interface IBookChapter {
    get_title(): string
    get_description(): string
    meta(): Map<String, any>
}
export enum ETextType {
    TXT, PUNCTUATION, NEW_LINE, IMG, NEW_PAGE, TXTGROUP
}

export interface ITextFormat {
    bold?: boolean
    italic?: boolean
    underlined?: boolean
    color?: number
    zoomable?: boolean
    direction?: EDirection
    selected?: boolean
}
export interface IText<T> {
    type: ETextType
    get_content(): T
    format?: ITextFormat
    envFormat?: IFormat
    paragraph: IParagraph
    text_group?: ITextGroup
    index_in_group?: number
    
}
export interface ITextGroup {
    type: ETextType //only can be TXTGROUP
    direction?: EDirection
    format?: ITextFormat
    paragraph: IParagraph
    get_texts(): Promise<Array<IText<any>>>
    get_length(): Promise<number>
    split_to_index(toIndex: number): Promise<Array<ITextGroup>>
    get_first(): Promise<IText<any>>
}
export interface IParagraph {
    direction?: EDirection
    format?: ITextFormat
    chapter: IChapter
    get_texts(): Promise<Array<ITextGroup | IText<any>>>
    get_text(i: number): Promise<IText<any> | ITextGroup>
    get_length(): Promise<number>
    get_flatten_length(): Promise<number>
}

export interface IChapter {
    direction?: EDirection
    format?: ITextFormat
    get_paragraphs(): Promise<IParagraph[]>
    get_paragraph(i: number): Promise<IParagraph>
    get_length(): Promise<number>
    book: IBook

}
export interface IBook {
    direction: EDirection
    get_chapters(): Promise<IChapter[]>
    get_chapter(i: number): Promise<IChapter>
    get_length(): Promise<number>

}

export interface ISerialRendererState {
    chapter: number
    paragraph: number
    item: number | Array<number>
}
export interface ISerialRendererItemProvider {
    init(book: IBook, chapter: number, paragraph: number, item: number | Array<number>): Promise<ISerialRendererState>

    nextTextItem(): Promise<IText<any>>
    prevTextItem(): Promise<IText<any>>

    get_state(): Promise<ISerialRendererState>
    set_state(new_state: ISerialRendererState): void
}
