import { IColor } from "./IColor";
import { EDirection } from "./IBook";

export interface IFormat {
    direction?: EDirection
    bold?: boolean
    italic?: boolean
    underlined?: boolean
    color?: IColor
    fontFamily: string
    fontSize: string
    backgroundColor: IColor
    brightness: number
    zoomable: boolean
}