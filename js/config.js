/* =========================================================
   サイト設定（ここを書き換えるだけで調整できます）
   ========================================================= */
window.TAMAYURA_CONFIG = {
  // 「このイメージで相談・予約する」ボタンのリンク先。
  // 例: 'https://tamayura.example.com/reserve'
  // 空のままだと、ボタンを押したときに「準備中」と表示されます。
  BOOKING_URL: '',

  // 保存画像に入れる小さな表記
  WATERMARK: {
    enabled: true,
    text: 'Virtual Try-on by Tamayura',
  },

  // 保存ファイル名の先頭
  FILE_PREFIX: 'tamayura-tryon',

  // 写真の最大サイズ（長い辺のピクセル数）。大きすぎるとスマホで重くなります。
  MAX_PHOTO_SIZE: 2000,

  // 同時に置けるデザインの数（初期版は1つ。将来 2 以上にすると複数配置になります）
  MAX_LAYERS: 1,

  // サイズ・料金表（Tamayura 料金表・サイズチャートより）
  // ・デザインの「短い辺 × 長い辺」が、どれかの型に収まるいちばん小さい区分になります。
  //   shapes は [短い辺mm, 長い辺mm]。左から 正円 / 楕円 / 長い円 です。
  // ・price：通常料金（デザインから選ぶ場合） / orderPrice：オーダー料金（オリジナルデザイン・将来用）
  // ・料金や文言はここを書き換えるだけで画面に反映されます。
  SIZE_TIERS: [
    { cm: 2,   shapes: [[20, 20]],                         price: 550,   orderPrice: null,  note: '他の施術に追加する場合のみ', compare: '1円玉くらい' },
    { cm: 3,   shapes: [[30, 30],   [20, 45],  [15, 60]],  price: 1650,  orderPrice: 1850,  compare: '500円玉くらい' },
    { cm: 5,   shapes: [[50, 50],   [40, 60],  [25, 100]], price: 2970,  orderPrice: 3300,  compare: '名刺の短い辺くらい' },
    { cm: 6.5, shapes: [[65, 65],   [50, 80],  [35, 120]], price: 3850,  orderPrice: 4400,  compare: '名刺の短い辺より大きめ' },
    { cm: 8,   shapes: [[80, 80],   [60, 110], [45, 130]], price: 4950,  orderPrice: 5500,  compare: '1000円札の半分くらい' },
    { cm: 10,  shapes: [[100, 100], [70, 140], [55, 180]], price: 7150,  orderPrice: 7700,  compare: '名刺2枚分くらい' },
    { cm: 12,  shapes: [[120, 120], [100, 145],[75, 190]], price: 9350,  orderPrice: 11000, compare: 'ハガキ1枚分くらい' },
    { cm: 15,  shapes: [[150, 150], [125, 180],[100, 220]],price: 12100, orderPrice: 13500, compare: 'ハガキより大きめ' },
  ],
  // いちばん大きい区分を超えたときの表示
  OVER_SIZE_TEXT: '15cm より大きいサイズはご相談ください',

  // 撮影部位ごとの「写真の短い辺に写っている幅（cm）」の想定値。
  // 実寸を測れないため、この値を使って「サイズの目安」を計算します。
  BODY_PARTS: [
    { id: 'wrist',    label: '手首', frameCm: 14 },
    { id: 'arm',      label: '腕',   frameCm: 22 },
    { id: 'ankle',    label: '足首', frameCm: 16 },
    { id: 'leg',      label: '脚',   frameCm: 30 },
    { id: 'shoulder', label: '肩',   frameCm: 30 },
    { id: 'back',     label: '背中', frameCm: 45 },
  ],
  DEFAULT_BODY_PART: 'arm',

  // ジャグア風表示の仕上がり色（左から順に表示）
  INK_COLORS: [
    { id: 'peak',    label: 'しっかり', note: '施術1〜2日後の濃さ', color: '#171c2b' },
    { id: 'natural', label: 'ナチュラル', note: '標準的な発色',     color: '#26314c' },
    { id: 'fading',  label: 'うすめ',   note: '色が落ち着いた頃',   color: '#4c5a7c' },
  ],
  DEFAULT_INK: 'natural',
  DEFAULT_OPACITY: 85, // %
};
