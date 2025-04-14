# Fluent Assist - 吃音者向け文書作成支援ツール

https://github.com/user-attachments/assets/d89cc6d2-ad65-4c1f-a92b-4b4502bce93b
## プロジェクトの概要

吃音を持つ方々が人前で発表する際の原稿作成をサポートするWebアプリケーションです．吃音に特徴的な中核症状として主に以下の3つがあります．
- 音の繰り返し（連発）　例：「か、か、からす」
- 引き伸ばし（伸発）　例：「かーーらす」
- ことばを出せずに間があいてしまう（難発、ブロック）例：「・・・・からす」    

特に，難発性の吃音は患者一人ひとりが比較的言いやすい音や，発音することが難しい音を持っていることが多いです．
そこで，患者自身にとって発音が難しい単語を検出し，代替となる表現を提案することで，よりスムーズな発表の支援を目的としています．

## 主な機能
- 文章中の発音が難しい単語の検出
- リアルタイムでの文章分析
- マスク言語モデル（MLM)を使用した，文脈を考慮した代替表現の提案
- 置き換えする単語の意味 + 発音が容易な音を考慮したサジェスト

## 使用技術

### フロントエンド
- React + TypeScript
- Vite
- Tailwind CSS
- Draft.js

### バックエンド
- FastAPI
- 日本語BERTモデル
- MeCab（形態素解析）
- Docker

## 今後の展望
1. より精度の高い代替表現の提案
2. ユーザーフィードバックに基づく改善
3. モバイルアプリケーションの開発
