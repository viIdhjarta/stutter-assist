import axios from 'axios';

// APIのベースURL
const API_BASE_URL = 'http://localhost:8000';

// APIクライアントの設定
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});


// リアルタイム分析API（難しい単語と代替案を一度に取得）
export const analyzeRealtime = async (text: string, easyPronunciations: string[] = [], difficultPronunciations: string[] = []) => {
  try {
    const response = await apiClient.post('/analyze-realtime', {
      text,
      easy_sounds: easyPronunciations,
      difficult_sounds: difficultPronunciations
    });
    console.log('リアルタイム分析結果:', response.data); // デバッグ用ログ
    return response.data;
  } catch (error) {
    console.error('リアルタイム分析に失敗しました', error);
    throw error;
  }
};


// BERTを使用してマスクされた単語の代替案を取得するAPI
export const getSmartAlternatives = async (text: string, targetWord: string, easyPronunciations: string[] = []) => {
  try {
    const response = await apiClient.post('/smart-alternatives', {
      text,
      target_word: targetWord,
      method: 'mlm',
      easy_pronunciations: easyPronunciations
    });

    // 応答形式の変更を処理
    if (response.data.alternatives) {
      // 代替案オブジェクト全体を返す（読み情報も含む）
      const alternatives = response.data.alternatives
        .filter((alt: any) => alt.word !== targetWord); // 元の単語と同じものは除外

      return { alternatives };
    } else {
      return { alternatives: [] };
    }
  } catch (error) {
    console.error(`単語「${targetWord}」の高度な代替案取得に失敗しました`, error);
    return { alternatives: [] }; // エラー時は空の配列を返す
  }
};

// APIのバージョンやステータスを確認するAPI
export const checkApiStatus = async () => {
  try {
    const response = await apiClient.get('/');
    return response.data;
  } catch (error) {
    console.error('API接続エラー', error);
    throw error;
  }
};

export default {
  analyzeRealtime,
  getSmartAlternatives,
  checkApiStatus,
}; 