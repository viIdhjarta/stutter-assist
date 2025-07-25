from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
import nlp_utils

app = FastAPI(
    title="Fluent Assist API",
    description="吃音支援アプリケーションのバックエンドAPI",
    version="1.0.0",
)

# CORSミドルウェアの設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],  # Viteのデフォルトポート
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# リクエスト/レスポンスモデル
class TextAnalysisRequest(BaseModel):
    text: str
    difficulty_threshold: Optional[float] = 0.5
    user_difficult_words: Optional[List[str]] = None
    difficult_sounds: Optional[List[str]] = None


class AlternativesRequest(BaseModel):
    text: str
    target_word: str
    method: Optional[str] = "both"  # "mlm", "embeddings", "both"
    easy_pronunciations: Optional[List[str]] = None  # ユーザーが発音しやすい音のリスト


class Alternative(BaseModel):
    word: str
    score: float
    original_score: float
    reading: str


class AlternativesResponse(BaseModel):
    word: str
    alternatives: List[Alternative]


@app.get("/")
async def root():
    return {"message": "Fluent Assist API", "status": "ok"}



# ポップオーバークリック時の代替案生成
@app.post("/smart-alternatives", response_model=AlternativesResponse)
async def get_smart_alternatives(request: AlternativesRequest):
    """
    BERTモデルを使用して文脈に基づいた代替案を生成
    """
    try:
        alternatives = []

        # MLMによる代替案生成
        if request.method in ["mlm", "both"]:
            mlm_alternatives = nlp_utils.generate_alternatives_with_mlm(
                request.text, request.target_word, top_k=30
            )
            alternatives.extend(mlm_alternatives)

        # モックデータベースは使用せず、MLMの結果のみを使用
        # 代替案がない場合は空のリストを返す
        if not alternatives:
            return {"word": request.target_word, "alternatives": []}

        # 発音のしやすさでフィルタリング（ユーザーの発音しやすい音を考慮）
        filtered_alternatives = nlp_utils.filter_by_pronunciation_ease(
            alternatives, easy_pronunciations=request.easy_pronunciations
        )

        return {"word": request.target_word, "alternatives": filtered_alternatives}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"代替案生成中にエラーが発生しました: {str(e)}"
        )

#　テキストが編集されたときに呼び出されるエンドポイント
@app.post("/analyze-realtime")
async def analyze_realtime(request: TextAnalysisRequest):
    """
    リアルタイムにテキストを分析して難しい単語と代替案を一度に返す
    形態素解析の結果を利用して正確な単語の位置情報を返す
    """
    try:
        # 形態素解析と難しい単語を検出（苦手な音を含む）
        difficult_words = nlp_utils.get_difficult_words(
            request.text,
            request.difficulty_threshold,
            request.difficult_sounds,
        )

        # 各難しい単語に対して代替案を生成
        words = []

        for word_info in difficult_words:
            word = word_info["word"]

            # 結果を追加（文字位置情報を含む）
            words.append(
                {
                    "word": word,
                    "position": word_info["position"],
                    "difficulty": word_info["difficulty"],
                    "reason": word_info.get("reason", ""),
                    "start": word_info.get("start", 0),
                    "end": word_info.get("end", 0),
                    "reading": word_info.get("reading", ""),  # 読み情報も追加
                }
            )

        # テキスト全体の読みを取得（2つのバージョンを返す）
        text_pronunciation = nlp_utils.get_pronunciation(request.text)

        return {
            "text": request.text,  # 元のテキスト
            "pronunciation": text_pronunciation,  # 読み
            "words": words,  # 難しい単語とその代替案のオブ
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"リアルタイム分析中にエラーが発生しました: {str(e)}",
        )
