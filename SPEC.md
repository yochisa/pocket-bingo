# イービンゴ 仕様書 v0.1

## コンセプト
結婚式などのイベントで使うビンゴアプリ。
スマホをカード代わりにして、番号の穴開けを自動化する。
「どの番号が引かれたか分からなくなる」「どこを開ければいいか分からない」問題を解決。

## 基本仕様
- カード：5×5（中央はFREE）
- 数字範囲：1〜75
- ビンゴ条件：1列（縦・横・斜め）
- リアルタイム同期：Supabase Realtime
- プラットフォーム：スマホ前提（レスポンシブ）

## 画面構成

### トップ画面
- 「主催者として始める」ボタン
- 「参加者として入る」ボタン

### 主催者フロー
1. ルーム設定画面
   - ビンゴ上限人数設定（1〜10人、デフォルト3）
   - 「ルーム作成」ボタン
2. 待機画面（主催者）
   - 6桁ルームコード表示
   - QRコード表示
   - 参加者一覧（ニックネーム・人数）
   - 「ゲーム開始」ボタン
3. 進行画面（主催者）
   - ルーレットボタン（タップで番号抽選）
   - 現在引いた番号を大きく表示
   - 引いた番号の履歴一覧
   - 参加者一覧（リーチ人数・ビンゴ者・順位）
   - ビンゴ達成者の通知

### 参加者フロー
1. 参加画面
   - ルームコード入力（6桁数字）
   - ニックネーム入力
   - 「参加する」ボタン
2. 待機画面（参加者）
   - 「主催者がゲームを開始するまでお待ちください」
   - 参加者一覧表示
3. ゲーム画面（参加者）
   - ビンゴカード（5×5）
   - 引かれた番号は自動でハイライト・穴開き
   - 引かれた番号の履歴（小さく表示）
   - リーチ時：エフェクト表示
   - ビンゴ時：エフェクト表示＋順位表示

## 参加タイミング
- ゲーム開始後5分間は遅れて入室可能
- 入室した瞬間にカードが配布される
- 5分経過後は入室不可

## DBスキーマ（Supabase）

### rooms
```sql
create table rooms (
  id uuid primary key default gen_random_uuid(),
  room_code char(6) unique not null,
  host_id uuid not null,
  status text default 'waiting', -- waiting / playing / finished
  max_winners int default 3,
  entry_deadline timestamptz,
  created_at timestamptz default now()
);
```

### players
```sql
create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id),
  nickname text not null,
  card jsonb not null, -- 5x5の数字配列
  opened_numbers jsonb default '[]',
  is_reach boolean default false,
  is_bingo boolean default false,
  bingo_rank int,
  joined_at timestamptz default now()
);
```

### drawn_numbers
```sql
create table drawn_numbers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id),
  number int not null,
  drawn_at timestamptz default now()
);
```

## 技術スタック
- フロント：Next.js（App Router）+ Tailwind CSS
- バックエンド：Supabase（DB + Realtime + Auth不要）
- デプロイ：Vercel
- 言語：TypeScript

## リアルタイム同期の流れ
1. 主催者がルーレットボタンをタップ
2. drawn_numbersテーブルにINSERT
3. Supabase Realtimeが全参加者にプッシュ
4. 各スマホが番号受信→カードと照合→自動ハイライト
5. ビンゴ判定→playersテーブルを更新
6. 主催者画面に反映

## ビンゴカード生成ロジック
- B列(1-15)、I列(16-30)、N列(31-45)、G列(46-60)、O列(61-75)
- 各列から5個ランダム選択（N列中央はFREE）
- 参加者ごとに異なるカードを生成

## MVP優先機能（まず動かすもの）
1. ルーム作成・参加
2. カード配布
3. ルーレット（番号抽選）
4. リアルタイム穴開き
5. ビンゴ判定・順位表示

## 後回しでいい機能
- QRコード表示
- ビンゴ上限人数設定
- ゲーム開始後5分タイマー
- ビンゴ条件の選択（主催者設定）
- ビンゴカード確認機能（不正防止）
- リーチエフェクト・ビンゴエフェクト
