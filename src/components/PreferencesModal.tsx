import React, { useState } from 'react';

const STORAGE_KEYS = {
  DIFFICULT: 'difficult_pronunciations',
  EASY: 'easy_pronunciations'
} as const;

interface PreferencesModalProps {
  show: boolean;
  onHide: () => void;
  onSave: (easyPronunciations: string[], difficultPronunciations: string[]) => void;
}

const PreferencesModal: React.FC<PreferencesModalProps> = ({
  show,
  onHide,
  onSave,
}) => {

  // ローカルストレージから設定を読み込む
  const loadStoredSettings = () => {
    const storedDifficult = localStorage.getItem(STORAGE_KEYS.DIFFICULT);
    const storedEasy = localStorage.getItem(STORAGE_KEYS.EASY);

    return {
      difficult: storedDifficult ? JSON.parse(storedDifficult) : [],
      easy: storedEasy ? JSON.parse(storedEasy) : []
    };
  };

  // 設定を保存する関数
  const saveToLocalStorage = (easy: string[], difficult: string[]) => {
    localStorage.setItem(STORAGE_KEYS.EASY, JSON.stringify(easy));
    localStorage.setItem(STORAGE_KEYS.DIFFICULT, JSON.stringify(difficult));
  };

  const storedSettings = loadStoredSettings();
  const [easyPronunciations, setEasyPronunciations] = useState<string[]>(storedSettings.easy);
  const [difficultPronunciations, setDifficultPronunciations] = useState<string[]>(storedSettings.difficult);
  const [activeTab, setActiveTab] = useState<'seion' | 'dakuon' | 'handakuon'>('seion');

  // 50音図のデータ（縦書き用に再構成、重複を除去）
  const seion = [
    ['わ', 'ら', 'や', 'ま', 'は', 'な', 'た', 'さ', 'か', 'あ'],
    ['', 'り', '', 'み', 'ひ', 'に', 'ち', 'し', 'き', 'い'],
    ['', 'る', 'ゆ', 'む', 'ふ', 'ぬ', 'つ', 'す', 'く', 'う'],
    ['', 'れ', '', 'め', 'へ', 'ね', 'て', 'せ', 'け', 'え'],
    ['を', 'ろ', 'よ', 'も', 'ほ', 'の', 'と', 'そ', 'こ', 'お'],
    ['ん']
  ];

  const dakuon = [
    ['ば', 'だ', 'ざ', 'が'],
    ['び', 'ぢ', 'じ', 'ぎ'],
    ['ぶ', 'づ', 'ず', 'ぐ'],
    ['べ', 'で', 'ぜ', 'げ'],
    ['ぼ', 'ど', 'ぞ', 'ご']
  ];

  const handakuon = [
    ['ぱ'],
    ['ぴ'],
    ['ぷ'],
    ['ぺ'],
    ['ぽ']
  ];

  const togglePronunciation = (sound: string) => {
    if (difficultPronunciations.includes(sound)) {
      // 難しい音（赤）から言いやすい音（緑）に変更
      setDifficultPronunciations(prev => prev.filter(s => s !== sound));
      setEasyPronunciations(prev => [...prev, sound]);
    } else if (easyPronunciations.includes(sound)) {
      // 言いやすい音（緑）から未設定（グレー）に変更
      setEasyPronunciations(prev => prev.filter(s => s !== sound));
    } else {
      // 未設定（グレー）から難しい音（赤）に変更
      setDifficultPronunciations(prev => [...prev, sound]);
    }
  };

  const handleSave = () => {
    saveToLocalStorage(easyPronunciations, difficultPronunciations);
    onSave(easyPronunciations, difficultPronunciations);
    onHide();
  };

  const renderSoundGrid = (sounds: string[][]) => (
    <div className="flex justify-center gap-4">
      {sounds[0].map((_, columnIndex) => (
        <div key={columnIndex} className="flex flex-col gap-3">
          {sounds.map((row, rowIndex) => (
            row[columnIndex] && row[columnIndex] !== '' && (
              <button
                key={`${rowIndex}-${columnIndex}`}
                className={`w-12 h-12 text-lg font-medium rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
                  difficultPronunciations.includes(row[columnIndex])
                    ? 'bg-red-500 text-white border-red-600 shadow-red-200 shadow-lg'
                    : easyPronunciations.includes(row[columnIndex])
                    ? 'bg-green-500 text-white border-green-600 shadow-green-200 shadow-lg'
                    : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                }`}
                onClick={() => togglePronunciation(row[columnIndex])}
              >
                {row[columnIndex]}
              </button>
            )
          ))}
        </div>
      ))}
    </div>
  );

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* オーバーレイ */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onHide}></div>
      
      {/* モーダルコンテンツ */}
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div className="relative w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-8 text-left align-middle shadow-2xl transition-all">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">
              🎤 発音設定
            </h3>
            <button
              onClick={onHide}
              className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* タブナビゲーション */}
          <div className="flex justify-center mb-8">
            <div className="flex bg-gray-100 rounded-xl p-1">
              {[
                { key: 'seion', label: '清音' },
                { key: 'dakuon', label: '濁音' },
                { key: 'handakuon', label: '半濁音' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as 'seion' | 'dakuon' | 'handakuon')}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                    activeTab === tab.key
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 音グリッド */}
          <div className="bg-gray-50 rounded-xl p-8 mb-6">
            {activeTab === 'seion' && renderSoundGrid(seion)}
            {activeTab === 'dakuon' && renderSoundGrid(dakuon)}
            {activeTab === 'handakuon' && renderSoundGrid(handakuon)}
          </div>

          {/* 説明 */}
          <div className="flex justify-center items-center space-x-8 mb-8">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 bg-green-500 rounded-lg shadow-sm"></div>
              <span className="text-sm font-medium text-gray-700">いいやすい音</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 bg-red-500 rounded-lg shadow-sm"></div>
              <span className="text-sm font-medium text-gray-700">苦手な音</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 bg-gray-200 rounded-lg shadow-sm"></div>
              <span className="text-sm font-medium text-gray-700">未設定</span>
            </div>
          </div>

          {/* フッター */}
          <div className="flex justify-end space-x-4">
            <button
              onClick={onHide}
              className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors duration-200"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-3 text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreferencesModal;