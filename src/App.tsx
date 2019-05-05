import React from 'react';
import logo from './logo.svg';
import './App.css';
import { SimpleBook, SimpleText, SimpleTextGroup, SimpleParagraph, SimpleChapter } from './helpers/SimpleBook';
import { MsdReader } from './components/MsdReader';
import { fontMetrics } from './utils/fontMetrics';
import { EDirection, ETextType } from './helpers/IBook';
import { SimpleSerialRendererItemProvider } from './helpers/SimpleSerialRendererItemProvider';
import {Font} from 'opentype.js'
const App: React.FC = () => {
  const txt = `شیراز یکی از شهرهای بزرگ ایران و کلان‌شهر زیبای این کشور و مرکز استان فارس است.
  جمعیت شیراز در سال ۱۳۹۵ خورشیدی بالغ بر ۱٬۵۶۵٬۵۷۲ تن بوده که این رقم با احتساب جمعیت ساکن در حومهٔ شهر به ۱٬۸۶۹٬۰۰۱ تن می‌رسد است 
 و همچنین سیصد و بیست و یکمین شهر پرجمعیت جهان و بیستمین شهر پرجمعیت باختر آسیا به‌شمار می‌رود.
  کلان‌شهر شیراز نیز بیستمین کلان‌شهر پرجمعیت خاورمیانه است. شیراز در بخش مرکزی استان فارس، در ارتفاع ۱۴۸۶ متر بالاتر از سطح دریا و در منطقهٔ کوهستانی زاگرس واقع شده و آب و هوای معتدلی دارد.
  این شهر از سمت غرب به کوه دراک، از سمت شمال به کوه‌های بمو، سبزپوشان، چهل‌مقام و باباکوهی (از رشته‌کوه‌های زاگرس) محدود شده‌است. 
 شیراز پس از تبریز (در سال ۱۲۸۷ خورشیدی) و تهران (در سال ۱۲۸۹ خورشیدی)، سومین شهر ایران بوده که در سال ۱۲۹۶ خورشیدی، نهاد شهرداری در آن تأسیس گردید. 
 شهرداری شیراز به ۱۱ منطقهٔ مستقل شهری تقسیم شده و جمعاً مساحتی بالغ بر ۲۴۰ کیلومتر مربع را شامل می‌شود.
  نام شیراز در کتاب‌ها و اسناد تاریخی، با نام‌های مختلفی نظیر «تیرازیس»، «شیرازیس» و «شیراز» به ثبت رسیده‌است.
  محل اولیهٔ این شهر در محل قلعهٔ ابونصر بوده‌است. شیراز در دوران بنی‌امیه به محل فعلی منتقل می‌شود و به بهای نابودیِ اصطخر — پایتخت قدیمیِ فارس — رونق می‌گیرد. این شهر در دوران صفاریان، بوییان و زندیان پایتخت ایران بوده‌است. `

  debugger;
  const new_page_item = new SimpleText("")
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

  const ch1 = new SimpleChapter(EDirection.rtl, null, [p])
  const book = new SimpleBook([book_title_chapter])
  const bookItemProvider = new SimpleSerialRendererItemProvider(book)
  debugger;

  function onNextPageButton() {
    alert("go next page")
  }
  // const c = fontMetrics.get_text_image("Arial","10px","سلام")
  return (
    <div className="App">
      <MsdReader
        width={400}
        height={400}
        ItemProvder={bookItemProvider}
        VWordSpace={5}
        margin={{
          right: 5,
          left: 5,
          top: 5

        }}
        btwLineSpace={10}
        readerStyle={
          {
            backgroundColor: { red: 255, green: 255, blue: 255, alpha: 1 },
            brightness: 1,
            color: { red: 0, green: 0, blue: 0, alpha: 1 },
            fontFamily: "Tahoma",
            fontSize: "16"
          }} >
      </MsdReader>
      <button onClick={onNextPageButton.bind(this)}>Next Page</button>
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

export default App;
