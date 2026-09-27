/* =========================================================
   デザイン一覧
   ---------------------------------------------------------
   新しいデザインを追加する手順
   1. 背景が透明な PNG（または SVG）を designs フォルダに入れる
      ・黒い線で描かれたデザインがおすすめです
      ・長い辺 1000〜2000px 程度
   2. 下のリストに { ... } を1つ追加する
      id       : 半角英数字の重複しない名前
      name     : 画面に表示する名前
      category : カテゴリータブに表示される分類
      tags     : 将来のタグ検索用（複数OK）
      src      : 画像ファイルの場所
      thumb    : 一覧用の小さい画像（省略すると src を使います）
   ========================================================= */
window.TAMAYURA_DESIGNS = [
  { id: 'mandala',   name: 'Mandala Bloom', category: '花',         tags: ['花', 'シンプル', 'ワンポイント'], src: 'designs/mandala.svg' },
  { id: 'heart',     name: 'Dot Heart',     category: 'ワンポイント', tags: ['ワンポイント', 'キュート'],     src: 'designs/heart.svg' },
  { id: 'moon',      name: 'Crescent',      category: 'ワンポイント', tags: ['ワンポイント', 'クール'],       src: 'designs/moon.svg' },
  { id: 'butterfly', name: 'Butterfly',     category: '蝶',         tags: ['蝶', 'キュート'],             src: 'designs/butterfly.svg' },
  { id: 'fern',      name: 'Fern',          category: '植物',        tags: ['植物', 'シンプル'],           src: 'designs/fern.svg' },
  { id: 'snake',     name: 'Serpent',       category: '蛇',         tags: ['蛇', 'クール'],               src: 'designs/snake.svg' },
  { id: 'tribal',    name: 'Tribal Band',   category: 'トライバル',   tags: ['トライバル', 'クール'],       src: 'designs/tribal.svg' },
  { id: 'wave',      name: 'Wave Line',     category: 'シンプル',     tags: ['シンプル', 'ワンポイント'],   src: 'designs/wave.svg' },
];
