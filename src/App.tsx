import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import { SimpleBook, SimpleText, SimpleTextGroup, SimpleParagraph, SimpleChapter } from './helpers/SimpleBook';
import { MsdReader } from './components/MsdReader';
import { fontMetrics } from './utils/fontMetrics';
import { EDirection, ETextType, ISerialRendererItemProvider } from './helpers/IBook';
import { SimpleSerialRendererItemProvider } from './helpers/SimpleSerialRendererItemProvider';
import { Font } from 'opentype.js'


interface IState {
  zoom: number
}
class App extends Component<{}, IState>{
  bookItemProvider: ISerialRendererItemProvider
  zoom: number
  constructor(pr: any) {
    super(pr)
    const new_page_item = new SimpleText("")
    const txt: string = `در اولین قسمت از مجموعه اینترنتی راه شیری به سراغ یکی از مهم ترین اخبار نجومی دهه‌های اخیر رفتیم؛ انتشار اولین تصویر واقعی از یک سیاهچاله در هفته های گذشته موجی از هیجان را در میان علاقمندان به نجوم و اخبار فضایی به راه انداخت. حالا و در اولین قسمت از برنامه نجومی راه شیری، سیاوش صفاریان پور به گفتگو با کارشناسان خبره نجومی پرداخته تا پاسخ سوالاتی را پیدا کند که پس از انتشار اولین تصویر واقعی از سیاه‌چاله در ذهن علاقمندان به نجوم به وجود آمده بود.`

    new_page_item.type = ETextType.NEW_PAGE
    const book_title_para = new SimpleParagraph(EDirection.rtl, null, [
      new_page_item,
      new SimpleText("عنوان"),
      new SimpleText("کتاب"),
      new SimpleTextGroup([new SimpleText("Maosud"), new SimpleText("IS"), new SimpleText("HEREO")], EDirection.ltr, null),
      new SimpleText("بوده"),
      new SimpleText("است"),



    ])
    const book_title_chapter = new SimpleChapter(EDirection.rtl, null, [book_title_para])

    const p = SimpleParagraph.from_string(txt, EDirection.rtl)
    p.insert_head(new_page_item)


    const ch1_title = new SimpleParagraph(EDirection.rtl, null, [new_page_item, new SimpleText("فصل"), new SimpleText("شیراز")])

    const ch1 = new SimpleChapter(EDirection.rtl, null, [SimpleParagraph.from_string(txt, EDirection.rtl)])
    const book = new SimpleBook([ch1])
    const bookItemProvider = new SimpleSerialRendererItemProvider(book)
    this.bookItemProvider = bookItemProvider
    this.state = {
      zoom: 1
    }
  }
  onNextPageButton() {
    const {zoom} = this.state
    this.setState({...this.state, zoom:zoom+0.2})
  }
  zoomout(){
    const {zoom} = this.state
    this.setState({...this.state, zoom:zoom-0.2})
  }
  render() {
    const {zoom} = this.state;
    return (
      <div className="App">
        <MsdReader
          width={400}
          height={400}
          ItemProvder={this.bookItemProvider}
          VWordSpace={5}
          margin={{
            right: 5,
            left: 5,
            top: 30

          }}
          btwLineSpace={20}
          readerStyle={
            {
              backgroundColor: { red: 255, green: 255, blue: 255, alpha: 1 },
              brightness: 1,
              color: { red: 0, green: 0, blue: 0, alpha: 1 },
              fontFamily: "Tahoma",
              fontSize: 26
            }}
          zoom={zoom}
        >
        </MsdReader>
        <button onClick={this.onNextPageButton.bind(this)}>Next Page</button>
        <button onClick={this.zoomout.bind(this)}>zoomout</button>

        {/* <MsdReader width={400} height={440} start_line={0} book={b}>
  
        </MsdReader> */}
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <p>
            Edit <code>src/App.tsx</code> and save to reload.
          </p>
          <a
            className="App-link"
            href="https://reactjs.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn React
          </a>
        </header>
      </div>
    );
  }

}


export default App;
