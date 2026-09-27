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

  // サイズと料金の目安（Tamayura のサイズ表より）
  // ・サイズは「面積」で区分します。細長いデザイン（レタリングなど）は、
  //   同じ面積になるように長くなります。
  // ・料金や比較の文言はここを書き換えるだけで画面に反映されます。
  SIZE_TIERS: [
    { cm: 2,   price: null, compare: '1円玉くらい',        note: 'オプションのみ' },
    { cm: 3,   price: 1650, compare: '500円玉くらい' },
    { cm: 5,   price: 2970, compare: '名刺の短い辺くらい' },
    { cm: 6.5, price: 3850, compare: '名刺の短い辺より少し大きめ' },
    { cm: 8,   price: 4950, compare: '1000円札の半分くらい' },
    { cm: 10,  price: 7150, compare: '名刺2枚分くらい' },
    { cm: 12,  price: 9350, compare: 'ハガキ1枚分くらい' },
  ],
  // 最大サイズを超えたときの表示
  OVER_SIZE_TEXT: '12cm より大きいサイズはご相談ください',

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
