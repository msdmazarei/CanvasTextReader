import { ISerialRendererItemProvider, IBook, ISerialRendererState, ITextGroup, IText, ETextType, IParagraph } from "./IBook";
import { stat } from "fs";
import { IPromise } from "q";
import { error } from "util";
import { IFormat } from "./IFormat";

export class SimpleSerialRendererItemProvider implements ISerialRendererItemProvider {
    constructor(book: IBook) {
        this.init(book, 0, 0, 0)

    }
    async init(book: IBook, chapter: number, paragraph: number, item: number | number[]): Promise<ISerialRendererState> {
        this._book = book;
        this._state = { chapter: chapter, paragraph: paragraph, item: item }
        this._final_state = null;
        return this._state
    }
    async nextTextItem(): Promise<IText<any>> {
        // debugger;
        let new_state: ISerialRendererState = null;
        if (this._state == null) {
            if (this._last_move_was_forward == true) {
                return null
            } else {
                new_state = this._state = this._final_state

            }
        } else {
            new_state = await this.get_next_text_state(this._state)
        }
        const t = await this.fetch_text(this._state)
        if (new_state == null) {
            debugger;
            this._final_state = this._state
            this._last_move_was_forward = true
        }
        this._state = new_state

        return t

    }
    async prevTextItem(): Promise<IText<any>> {
        // debugger;
        let new_state: ISerialRendererState = null;

        if (this._state == null) {
            debugger;
            if (this._last_move_was_forward == false) {
                return null
            } else {
                new_state = this._state = this._final_state
            }
        } else {
            new_state = await this.get_prev_text_state(this._state)
        }

        const t = await this.fetch_text(this._state)

        if (new_state == null) {
            this._final_state = this._state
            this._last_move_was_forward = false
        }
        this._state = new_state
        return t
    }
    async get_state(): Promise<ISerialRendererState> {
        return this._state
    }
    set_state(new_state: ISerialRendererState): void {
        this._state = new_state
    }

    async get_next_text_in_para(current_state: ISerialRendererState, para_instance: IParagraph): Promise<ISerialRendererState> {
        const { chapter, paragraph, item } = current_state
        // debugger;
        const text_len = await para_instance.get_length()
        if (typeof (item) == "number") {
            if (!(text_len > item)) throw Error("bad index")
            const available_next_text = text_len > (item + 1) ? item + 1 : null;
            if (available_next_text) {
                const next_text_instance = await para_instance.get_text(item + 1)
                if (next_text_instance.type == ETextType.TXTGROUP) {
                    const sub_items = await (next_text_instance as ITextGroup).get_texts()
                    if (sub_items.length == 0)
                        //skip empty TextGroups
                        return await this.get_next_text_state({ chapter: chapter, paragraph: paragraph, item: item + 1 })
                    return { chapter: chapter, paragraph: paragraph, item: [item + 1, 0, -1] }
                } else {
                    return { chapter: chapter, paragraph: paragraph, item: item + 1 }
                }
            } else {
                return null
            }
        } else {
            const [item_index, word_index, _] = item;
            if (!(text_len > item_index)) throw new Error("bad index");
            const group: ITextGroup = await para_instance.get_text(item_index) as ITextGroup
            const words = await group.get_texts()
            if (!(words.length > word_index)) throw new Error("bad index");
            const available_next_word_in_group = words.length > (word_index + 1) ? word_index + 1 : null
            if (available_next_word_in_group) {
                return { ...current_state, item: [item_index, word_index + 1, -1] }
            } else {
                if (!(text_len > (item_index + 1))) return null;
                return await this.get_next_text_in_para({ ...current_state, item: item_index }, para_instance)
            }
        }

    }

    async get_perv_text_in_para(current_state: ISerialRendererState, para_instance: IParagraph): Promise<ISerialRendererState> {
        const { chapter, paragraph, item } = current_state
        // debugger;
        if (typeof (item) == "number") {
            if (item < 0) throw Error("bad index")
            const available_prev_text = (item - 1) > -1 ? item - 1 : null;
            if (available_prev_text != null && available_prev_text > -1) {
                const prev_text_instance = await para_instance.get_text(item - 1)
                if (prev_text_instance.type == ETextType.TXTGROUP) {
                    const sub_items = await (prev_text_instance as ITextGroup).get_texts()
                    if (sub_items.length == 0)
                        //skip empty TextGroups
                        return await this.get_next_text_state({ chapter: chapter, paragraph: paragraph, item: item - 1 })
                    return { chapter: chapter, paragraph: paragraph, item: [item - 1, sub_items.length - 1, -1] }
                } else {
                    return { chapter: chapter, paragraph: paragraph, item: item - 1 }
                }
            } else {
                return null
            }
        } else {
            const [item_index, word_index, _] = item;
            if (item_index < 0) throw new Error("bad index");
            const group: ITextGroup = await para_instance.get_text(item_index) as ITextGroup
            const words = await group.get_texts()
            if (word_index < 0) throw new Error("bad index");
            const available_prev_word_in_group = (word_index - 1) > -1 ? word_index - 1 : null
            if (available_prev_word_in_group != null && available_prev_word_in_group > -1) {
                return { ...current_state, item: [item_index, word_index - 1, -1] }
            } else {
                if ((item_index - 1) < 0) return null;
                return await this.get_perv_text_in_para({ ...current_state, item: item_index }, para_instance)
            }
        }

    }
    async get_next_text_state(current_state: ISerialRendererState): Promise<ISerialRendererState> {
        // debugger;
        const { chapter, paragraph } = current_state
        const chapter_len = await this._book.get_length()
        if (!(chapter_len > chapter)) return null;
        const current_chapter_instance = await this._book.get_chapter(chapter);
        const available_next_chapter = chapter_len > (chapter + 1) ? chapter + 1 : null;

        const para_len = await current_chapter_instance.get_length()
        if (!(para_len > paragraph)) return null;
        const para_instance = await current_chapter_instance.get_paragraph(paragraph)
        const available_next_para = para_len > (paragraph + 1) ? paragraph + 1 : null;
        const next_word_state = await this.get_next_text_in_para(current_state, para_instance)
        if (next_word_state == null) {
            if (available_next_para) {
                return { chapter: chapter, paragraph: paragraph + 1, item: 0 }
            } else {
                if (available_next_chapter) {
                    return { chapter: chapter + 1, paragraph: 0, item: 0 }
                } else {
                    return null
                }
            }
        } else {
            return next_word_state
        }
    }

    async get_prev_text_state(current_state: ISerialRendererState): Promise<ISerialRendererState> {
        // debugger;
        const { chapter, paragraph } = current_state
        if (chapter < 0) return null;
        const current_chapter_instance = await this._book.get_chapter(chapter);
        const available_prev_chapter = chapter - 1 > -1 ? chapter - 1 : null;

        if (paragraph < 0) return null;
        const para_instance = await current_chapter_instance.get_paragraph(paragraph)
        const available_prev_para = (paragraph - 1) > -1 ? paragraph - 1 : null;
        const perv_word_state = await this.get_perv_text_in_para(current_state, para_instance)
        if (perv_word_state == null) {
            if (available_prev_para != null && available_prev_para > -1) {
                return { chapter: chapter, paragraph: paragraph - 1, item: 0 }
            } else {
                if (available_prev_chapter != null && available_prev_chapter > -1) {
                    return { chapter: chapter - 1, paragraph: 0, item: 0 }
                } else {
                    return null
                }
            }
        } else {
            return perv_word_state
        }
    }
    async fetch_text(current_state: ISerialRendererState): Promise<IText<any>> {
        const { chapter, paragraph, item } = current_state
        const chapter_instance = await this._book.get_chapter(chapter)
        const paragraph_instance = await chapter_instance.get_paragraph(paragraph)
        if (typeof (item) == "number") {
            const txt = await paragraph_instance.get_text(item) as IText<any>
            return txt

        } else {
            const [item_index, word_index, _] = item
            const item_instance = await paragraph_instance.get_text(item_index) as ITextGroup
            const txts = await item_instance.get_texts()
            const txt = txts[word_index]

            return txt
        }
    }


    _book: IBook;
    _state: ISerialRendererState
    _final_state: ISerialRendererState
    _last_move_was_forward: boolean

    // constructor(book: IBook) {

    //     this.init(book, 0, 0, 0);
    // }
    // async jump(chapter: number, paragraph: number, text: number) {
    //     await this.init(this._book, chapter, paragraph, text);
    // }

    // async get_state(): Promise<ISerialRendererState> {
    //     return this._state
    // }

    // async init(book: IBook, chapter: number, paragraph: number, text: number): Promise<ISerialRendererState> {
    //     this._book = book;
    //     this._state = { chapter: chapter, paragraph: paragraph, text: text };
    //     return this._state;
    // }

    // async nextItem(): Promise<IText<any> | ITextGroup> {
    //     const next_item = await this.fetch_item(this._state)
    //     const next_state = await this.get_next_state(this._state)
    //     if (next_state == null) {
    //         this._final_state = this._state;

    //     }
    //     this._state = next_state;
    //     return next_item;

    // }


    // async get_next_state(state: ISerialRendererState): Promise<ISerialRendererState> {
    //     const { chapter, paragraph, text } = state;
    //     let new_text = text + 1
    //     const chapter_instance = await this._book.get_chapter(chapter);
    //     const para_instance = await chapter_instance.get_paragraph(paragraph);
    //     const para_len = await para_instance.get_length()
    //     if (para_len > new_text) return { ...state, text: new_text }
    //     new_text = 0
    //     let new_para = paragraph + 1
    //     const chapter_len = await chapter_instance.get_length()
    //     if (chapter_len > new_para) return { ...state, text: new_text, paragraph: new_para }
    //     new_para = 0;
    //     const book_len = await this._book.get_length()
    //     let new_chapter = chapter + 1;
    //     if (book_len > new_chapter) return { chapter: new_chapter, paragraph: 0, text: 0 }
    //     return state;
    // }


    // async fetch_item(state: ISerialRendererState): Promise<IText <any>| ITextGroup> {

    //     const chapters_len = await this._book.get_length()
    //     if (!(chapters_len > state.chapter)) return null;
    //     if (state.chapter < 0) return null;
    //     const chapter = await this._book.get_chapter(state.chapter);

    //     const para_len = await chapter.get_length()
    //     if (!(para_len > state.paragraph)) return null;
    //     if (state.paragraph < 0) return null;
    //     const para = await chapter.get_paragraph(state.paragraph);


    //     const texts_len = await para.get_length()
    //     if (!(texts_len > state.text)) return null;
    //     if (state.text < 0) return null;
    //     const textItem = para.get_text(state.text)
    //     return textItem
    // }


}