import { useState, useEffect } from 'react';
import './App.css';
import NavBar from './components/NavBar';
import Editor from './components/Editor';
// import PreferencesModal from './components/PreferencesModal';
import PreferencesModal from './components/PreferencesModal';
import { checkApiStatus } from './services/apiService';

function App() {

  // モーダル表示状態の管理
  const [showPreferences, setShowPreferences] = useState<boolean>(false);

  // APIの状態管理
  const [apiConnected, setApiConnected] = useState<boolean>(false);

  // 設定値の管理
  const [easyWords, setEasyWords] = useState<string[]>([]);
  const [difficultWords, setDifficultWords] = useState<string[]>([]);

  // ローカルストレージから初期値を読み込む
  const loadStoredSettings = () => {
    const storedDifficult = localStorage.getItem('difficult_pronunciations');
    const storedEasy = localStorage.getItem('easy_pronunciations');
    return {
      difficult: storedDifficult ? JSON.parse(storedDifficult) : [],
      easy: storedEasy ? JSON.parse(storedEasy) : []
    };
  };

  const initialSettings = loadStoredSettings();

  // 初期値としてローカルストレージの値を使用（テスト用にデフォルト値も設定）
  const [easyPronunciations, setEasyPronunciations] = useState<string[]>(initialSettings.easy);
  const [difficultPronunciations, setDifficultPronunciations] = useState<string[]>(initialSettings.difficult);

  // APIの接続状態を確認する
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const status = await checkApiStatus();
        setApiConnected(status && status.status === 'ok');
      } catch (error) {
        console.error('API接続エラー:', error);
        setApiConnected(false);
      }
    };

    checkConnection();
    // 30秒ごとに接続状態を確認
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, []);


  // 簡単な単語をリストに追加
  const handleAddEasyWord = (word: string) => {
    if (!easyWords.includes(word)) {
      setEasyWords([...easyWords, word]);
    }
  };

  // 難しい単語をリストに追加
  const handleAddDifficultWord = (word: string) => {
    if (!difficultWords.includes(word)) {
      setDifficultWords([...difficultWords, word]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <NavBar
        onPreferencesClick={() => setShowPreferences(true)}
        apiConnected={apiConnected}
      />
      
      <main className="py-8">
        <Editor
          hardWords={difficultWords}
          onAddEasyWord={handleAddEasyWord}
          onAddDifficultWord={handleAddDifficultWord}
          userEasyWords={easyWords}
          userDifficultWords={difficultWords}
          easyPronunciations={easyPronunciations}
          difficultPronunciations={difficultPronunciations}
        />
      </main>

      {/* 設定モーダル */}
      <PreferencesModal
        show={showPreferences}
        onHide={() => setShowPreferences(false)}
        onSave={(easyPronunciations, difficultPronunciations) => {
          setEasyPronunciations(easyPronunciations);
          setDifficultPronunciations(difficultPronunciations);
          setShowPreferences(false);
        }}
      />
    </div>
  );
}

export default App; 