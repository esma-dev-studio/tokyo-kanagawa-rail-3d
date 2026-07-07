/**
 * N02(国土数値情報 鉄道データ)→ アプリ用データ変換の路線設定。
 *
 * - n02Operator / n02Lines は N02 の属性値(N02_004 / N02_003)そのまま。
 *   複数指定すると1つの路線に統合される(例: ブルーライン=1号線+3号線)。
 * - baseHeight: 路線全体の概算高さ[m](負=地下)。実測値ではなく視認性優先。
 *   地下鉄は路線ごとに数mずつ深さをずらし、交差時の重なりを避ける。
 * - pointOverrides: 特定駅付近だけ高さを変える(±約1.6kmをなだらかに接続)。
 * - rangeOverrides: 駅Aから駅Bまでの区間の高さを変える(端は約0.8kmでランプ)。
 * - color: 公式ラインカラーに近い色(暗背景での視認性・識別性を優先して調整)。
 */

export const BBOX = { minLat: 35.1, maxLat: 35.95, minLon: 138.9, maxLon: 140.05 };

/** 乗り入れ路線数によらず主要駅として扱う駅名(N02の駅名表記) */
export const MAJOR_STATIONS_MANUAL = [
  "浅草", "押上", "北千住", "中目黒", "目黒", "蒲田", "川崎", "京急川崎",
  "自由が丘", "二子玉川", "溝の口", "武蔵小杉", "日吉", "菊名",
  "立川", "八王子", "町田", "調布", "下北沢", "新百合ヶ丘", "登戸",
  "関内", "上大岡", "戸塚", "湘南台", "海老名", "本厚木", "大船", "藤沢", "小田原",
  "みなとみらい", "元町・中華街", "六本木", "豊洲", "西船橋", "大宮",
  "羽田空港第1・第2ターミナル",
];

/** これ以上の路線数が乗り入れる駅は自動的に主要駅とする */
export const MAJOR_AUTO_LINE_COUNT = 3;

export const LINES = [
  // ============================== Phase 1: 地下鉄 ==============================
  {
    lineId: "ginza", lineName: "銀座線", category: "subway", structureType: "underground",
    operatorId: "tokyo-metro", operatorName: "東京メトロ",
    n02Operator: "東京地下鉄", n02Lines: ["3号線銀座線"],
    color: "#F5A200", baseHeight: -15,
    pointOverrides: { 渋谷: 8 },
  },
  {
    lineId: "marunouchi", lineName: "丸ノ内線", category: "subway", structureType: "underground",
    operatorId: "tokyo-metro", operatorName: "東京メトロ",
    n02Operator: "東京地下鉄", n02Lines: ["4号線丸ノ内線", "4号線丸ノ内線分岐線"],
    color: "#F62E36", baseHeight: -18,
    pointOverrides: { 四ツ谷: 3, 後楽園: 8, 茗荷谷: 2, 御茶ノ水: -10 },
  },
  {
    lineId: "hibiya", lineName: "日比谷線", category: "subway", structureType: "underground",
    operatorId: "tokyo-metro", operatorName: "東京メトロ",
    n02Operator: "東京地下鉄", n02Lines: ["2号線日比谷線"],
    color: "#A7B2BD", baseHeight: -21,
    rangeOverrides: [{ from: "三ノ輪", to: "北千住", height: 8 }],
  },
  {
    lineId: "tozai", lineName: "東西線", category: "subway", structureType: "underground",
    operatorId: "tokyo-metro", operatorName: "東京メトロ",
    n02Operator: "東京地下鉄", n02Lines: ["5号線東西線"],
    color: "#00A3D0", baseHeight: -24,
    rangeOverrides: [{ from: "西葛西", to: "西船橋", height: 9 }],
  },
  {
    lineId: "chiyoda", lineName: "千代田線", category: "subway", structureType: "underground",
    operatorId: "tokyo-metro", operatorName: "東京メトロ",
    n02Operator: "東京地下鉄", n02Lines: ["9号線千代田線"],
    color: "#2FBF71", baseHeight: -27,
    pointOverrides: { 代々木上原: 5, 綾瀬: 6, 北綾瀬: 8 },
  },
  {
    lineId: "yurakucho", lineName: "有楽町線", category: "subway", structureType: "underground",
    operatorId: "tokyo-metro", operatorName: "東京メトロ",
    n02Operator: "東京地下鉄", n02Lines: ["8号線有楽町線"],
    color: "#D4AF5A", baseHeight: -30,
  },
  {
    lineId: "hanzomon", lineName: "半蔵門線", category: "subway", structureType: "underground",
    operatorId: "tokyo-metro", operatorName: "東京メトロ",
    n02Operator: "東京地下鉄", n02Lines: ["11号線半蔵門線"],
    color: "#9B7CC8", baseHeight: -33,
  },
  {
    lineId: "namboku", lineName: "南北線", category: "subway", structureType: "underground",
    operatorId: "tokyo-metro", operatorName: "東京メトロ",
    n02Operator: "東京地下鉄", n02Lines: ["7号線南北線"],
    color: "#17C3B2", baseHeight: -36,
  },
  {
    lineId: "fukutoshin", lineName: "副都心線", category: "subway", structureType: "underground",
    operatorId: "tokyo-metro", operatorName: "東京メトロ",
    n02Operator: "東京地下鉄", n02Lines: ["13号線副都心線"],
    color: "#C4763A", baseHeight: -39,
  },
  {
    lineId: "asakusa", lineName: "都営浅草線", category: "subway", structureType: "underground",
    operatorId: "toei", operatorName: "都営地下鉄",
    n02Operator: "東京都", n02Lines: ["1号線浅草線"],
    color: "#EC6E65", baseHeight: -17,
  },
  {
    lineId: "mita", lineName: "都営三田線", category: "subway", structureType: "underground",
    operatorId: "toei", operatorName: "都営地下鉄",
    n02Operator: "東京都", n02Lines: ["6号線三田線"],
    color: "#2E8FE0", baseHeight: -26,
    rangeOverrides: [{ from: "志村三丁目", to: "西高島平", height: 9 }],
  },
  {
    lineId: "shinjuku-toei", lineName: "都営新宿線", category: "subway", structureType: "underground",
    operatorId: "toei", operatorName: "都営地下鉄",
    n02Operator: "東京都", n02Lines: ["10号線新宿線"],
    color: "#6CBB5A", baseHeight: -23,
    rangeOverrides: [{ from: "東大島", to: "船堀", height: 9 }],
  },
  {
    lineId: "oedo", lineName: "都営大江戸線", category: "subway", structureType: "underground",
    operatorId: "toei", operatorName: "都営地下鉄",
    n02Operator: "東京都", n02Lines: ["12号線大江戸線"],
    color: "#CE2079", baseHeight: -40,
    pointOverrides: { 六本木: -42 },
  },
  {
    lineId: "blue-line", lineName: "ブルーライン", category: "subway", structureType: "underground",
    operatorId: "yokohama-city", operatorName: "横浜市営地下鉄",
    n02Operator: "横浜市", n02Lines: ["1号線", "3号線"],
    color: "#2496D8", baseHeight: -18,
    pointOverrides: { センター北: 10, センター南: 10 },
  },
  {
    lineId: "green-line", lineName: "グリーンライン", category: "subway", structureType: "underground",
    operatorId: "yokohama-city", operatorName: "横浜市営地下鉄",
    n02Operator: "横浜市", n02Lines: ["4号線"],
    color: "#3BC53B", baseHeight: -15,
    pointOverrides: { センター北: 10, センター南: 10, 川和町: 9 },
  },
  {
    lineId: "minatomirai", lineName: "みなとみらい線", category: "private", structureType: "underground",
    operatorId: "minatomirai", operatorName: "横浜高速鉄道",
    n02Operator: "横浜高速鉄道", n02Lines: ["みなとみらい21線"],
    color: "#5B67E8", baseHeight: -30,
  },

  // ============================== Phase 2: JR ==============================
  {
    lineId: "yamanote", lineName: "山手線", category: "jr", structureType: "elevated",
    operatorId: "jr-east", operatorName: "JR東日本",
    n02Operator: "東日本旅客鉄道", n02Lines: ["山手線"],
    color: "#9ACB3B", baseHeight: 6,
  },
  {
    // 京浜東北線は運転系統名のため、線路データとしては東北線(東京以北)と
    // 根岸線(横浜以南)で構成。東京〜横浜は東海道線の線路を走るため描画しない。
    lineId: "keihin-tohoku", lineName: "京浜東北・根岸線", category: "jr", structureType: "elevated",
    operatorId: "jr-east", operatorName: "JR東日本",
    n02Operator: "東日本旅客鉄道", n02Lines: ["東北線", "根岸線"],
    color: "#29C5F6", baseHeight: 7,
  },
  {
    lineId: "chuo", lineName: "中央線", category: "jr", structureType: "elevated",
    operatorId: "jr-east", operatorName: "JR東日本",
    n02Operator: "東日本旅客鉄道", n02Lines: ["中央線"],
    color: "#F04A22", baseHeight: 7,
  },
  {
    lineId: "sobu", lineName: "総武線", category: "jr", structureType: "elevated",
    operatorId: "jr-east", operatorName: "JR東日本",
    n02Operator: "東日本旅客鉄道", n02Lines: ["総武線"],
    color: "#F9B000", baseHeight: 5,
    rangeOverrides: [{ from: "東京", to: "錦糸町", height: -22 }],
  },
  {
    lineId: "tokaido", lineName: "東海道線", category: "jr", structureType: "ground",
    operatorId: "jr-east", operatorName: "JR東日本",
    n02Operator: "東日本旅客鉄道", n02Lines: ["東海道線"],
    color: "#EE8E2E", baseHeight: 4,
  },
  {
    // N02 の横須賀線は正式区間(大船〜久里浜)。東京〜大船は東海道線の線路上。
    lineId: "yokosuka", lineName: "横須賀線", category: "jr", structureType: "ground",
    operatorId: "jr-east", operatorName: "JR東日本",
    n02Operator: "東日本旅客鉄道", n02Lines: ["横須賀線"],
    color: "#3B5FCB", baseHeight: 3,
  },
  {
    lineId: "nambu", lineName: "南武線", category: "jr", structureType: "ground",
    operatorId: "jr-east", operatorName: "JR東日本",
    n02Operator: "東日本旅客鉄道", n02Lines: ["南武線"],
    color: "#E4D149", baseHeight: 3,
  },
  {
    lineId: "yokohama-line", lineName: "横浜線", category: "jr", structureType: "ground",
    operatorId: "jr-east", operatorName: "JR東日本",
    n02Operator: "東日本旅客鉄道", n02Lines: ["横浜線"],
    color: "#57A83C", baseHeight: 4,
  },

  // ============================== Phase 3: 私鉄 ==============================
  {
    lineId: "toyoko", lineName: "東急東横線", category: "private", structureType: "ground",
    operatorId: "tokyu", operatorName: "東急電鉄",
    n02Operator: "東急電鉄", n02Lines: ["東横線"],
    color: "#E24162", baseHeight: 5,
    pointOverrides: { 渋谷: -14, 反町: -10, 横浜: -18 },
  },
  {
    lineId: "denentoshi", lineName: "東急田園都市線", category: "private", structureType: "ground",
    operatorId: "tokyu", operatorName: "東急電鉄",
    n02Operator: "東急電鉄", n02Lines: ["田園都市線"],
    color: "#29B573", baseHeight: 6,
    rangeOverrides: [{ from: "渋谷", to: "二子玉川", height: -14 }],
  },
  {
    lineId: "meguro-line", lineName: "東急目黒線", category: "private", structureType: "ground",
    operatorId: "tokyu", operatorName: "東急電鉄",
    n02Operator: "東急電鉄", n02Lines: ["目黒線"],
    color: "#0FA8C2", baseHeight: 3,
    rangeOverrides: [{ from: "目黒", to: "洗足", height: -12 }],
  },
  {
    lineId: "oimachi", lineName: "東急大井町線", category: "private", structureType: "ground",
    operatorId: "tokyu", operatorName: "東急電鉄",
    n02Operator: "東急電鉄", n02Lines: ["大井町線"],
    color: "#F1913F", baseHeight: 4,
  },
  {
    lineId: "ikegami", lineName: "東急池上線", category: "private", structureType: "ground",
    operatorId: "tokyu", operatorName: "東急電鉄",
    n02Operator: "東急電鉄", n02Lines: ["池上線"],
    color: "#EE86A7", baseHeight: 4,
  },
  {
    lineId: "tokyu-shinyoko", lineName: "東急新横浜線", category: "private", structureType: "underground",
    operatorId: "tokyu", operatorName: "東急電鉄",
    n02Operator: "東急電鉄", n02Lines: ["東急新横浜線"],
    color: "#B592E0", baseHeight: -20,
  },
  {
    lineId: "keikyu-main", lineName: "京急本線", category: "private", structureType: "elevated",
    operatorId: "keikyu", operatorName: "京浜急行電鉄",
    n02Operator: "京浜急行電鉄", n02Lines: ["本線"],
    color: "#F0334B", baseHeight: 8,
    pointOverrides: { 品川: 6, 横浜: 4 },
  },
  {
    lineId: "keikyu-airport", lineName: "京急空港線", category: "private", structureType: "elevated",
    operatorId: "keikyu", operatorName: "京浜急行電鉄",
    n02Operator: "京浜急行電鉄", n02Lines: ["空港線"],
    color: "#F4707F", baseHeight: 6,
    rangeOverrides: [{ from: "大鳥居", to: "羽田空港第1・第2ターミナル", height: -14 }],
  },
  {
    lineId: "keikyu-daishi", lineName: "京急大師線", category: "private", structureType: "ground",
    operatorId: "keikyu", operatorName: "京浜急行電鉄",
    n02Operator: "京浜急行電鉄", n02Lines: ["大師線"],
    color: "#D14E7E", baseHeight: 3,
  },
  {
    lineId: "keikyu-zushi", lineName: "京急逗子線", category: "private", structureType: "ground",
    operatorId: "keikyu", operatorName: "京浜急行電鉄",
    n02Operator: "京浜急行電鉄", n02Lines: ["逗子線"],
    color: "#F78CA0", baseHeight: 4,
  },
  {
    lineId: "keikyu-kurihama", lineName: "京急久里浜線", category: "private", structureType: "ground",
    operatorId: "keikyu", operatorName: "京浜急行電鉄",
    n02Operator: "京浜急行電鉄", n02Lines: ["久里浜線"],
    color: "#C22E44", baseHeight: 5,
  },
  {
    lineId: "odakyu", lineName: "小田急小田原線", category: "private", structureType: "ground",
    operatorId: "odakyu", operatorName: "小田急電鉄",
    n02Operator: "小田急電鉄", n02Lines: ["小田原線"],
    color: "#2D9CE5", baseHeight: 4,
    rangeOverrides: [{ from: "東北沢", to: "世田谷代田", height: -15 }],
  },
  {
    lineId: "odakyu-enoshima", lineName: "小田急江ノ島線", category: "private", structureType: "ground",
    operatorId: "odakyu", operatorName: "小田急電鉄",
    n02Operator: "小田急電鉄", n02Lines: ["江ノ島線"],
    color: "#5FB6EC", baseHeight: 3,
  },
  {
    lineId: "odakyu-tama", lineName: "小田急多摩線", category: "private", structureType: "ground",
    operatorId: "odakyu", operatorName: "小田急電鉄",
    n02Operator: "小田急電鉄", n02Lines: ["多摩線"],
    color: "#8ECCF2", baseHeight: 6,
  },
  {
    lineId: "keio", lineName: "京王線", category: "private", structureType: "ground",
    operatorId: "keio", operatorName: "京王電鉄",
    n02Operator: "京王電鉄", n02Lines: ["京王線"],
    color: "#D8437B", baseHeight: 4,
    rangeOverrides: [
      { from: "新宿", to: "笹塚", height: -12 },
      { from: "国領", to: "調布", height: -12 },
    ],
  },
  {
    lineId: "inokashira", lineName: "京王井の頭線", category: "private", structureType: "ground",
    operatorId: "keio", operatorName: "京王電鉄",
    n02Operator: "京王電鉄", n02Lines: ["井の頭線"],
    color: "#6A5AE0", baseHeight: 3,
  },
  {
    lineId: "keio-sagamihara", lineName: "京王相模原線", category: "private", structureType: "elevated",
    operatorId: "keio", operatorName: "京王電鉄",
    n02Operator: "京王電鉄", n02Lines: ["相模原線"],
    color: "#E077A8", baseHeight: 7,
  },
  {
    lineId: "sotetsu-main", lineName: "相鉄本線", category: "private", structureType: "ground",
    operatorId: "sotetsu", operatorName: "相模鉄道",
    n02Operator: "相模鉄道", n02Lines: ["相鉄本線"],
    color: "#8A9BD8", baseHeight: 3,
  },
  {
    lineId: "sotetsu-izumino", lineName: "相鉄いずみ野線", category: "private", structureType: "ground",
    operatorId: "sotetsu", operatorName: "相模鉄道",
    n02Operator: "相模鉄道", n02Lines: ["相鉄いずみ野線"],
    color: "#A4B4E4", baseHeight: 2,
  },
  {
    lineId: "sotetsu-shinyoko", lineName: "相鉄新横浜線", category: "private", structureType: "underground",
    operatorId: "sotetsu", operatorName: "相模鉄道",
    n02Operator: "相模鉄道", n02Lines: ["相鉄新横浜線"],
    color: "#B8C4EC", baseHeight: -20,
  },
  {
    lineId: "seibu-ikebukuro", lineName: "西武池袋線", category: "private", structureType: "ground",
    operatorId: "seibu", operatorName: "西武鉄道",
    n02Operator: "西武鉄道", n02Lines: ["池袋線"],
    color: "#F0A030", baseHeight: 4,
  },
  {
    lineId: "seibu-shinjuku", lineName: "西武新宿線", category: "private", structureType: "ground",
    operatorId: "seibu", operatorName: "西武鉄道",
    n02Operator: "西武鉄道", n02Lines: ["新宿線"],
    color: "#49B8E8", baseHeight: 4,
  },
  {
    lineId: "tobu-skytree", lineName: "東武伊勢崎線", category: "private", structureType: "elevated",
    operatorId: "tobu", operatorName: "東武鉄道",
    n02Operator: "東武鉄道", n02Lines: ["伊勢崎線"],
    color: "#0A78D0", baseHeight: 9,
  },
  {
    lineId: "tobu-tojo", lineName: "東武東上線", category: "private", structureType: "ground",
    operatorId: "tobu", operatorName: "東武鉄道",
    n02Operator: "東武鉄道", n02Lines: ["東上本線"],
    color: "#6FA0E8", baseHeight: 5,
  },
];
