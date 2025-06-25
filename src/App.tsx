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
    const storedFontSize = localStorage.getItem('font_size');
    const storedTheme = localStorage.getItem('theme');
    return {
      difficult: storedDifficult ? JSON.parse(storedDifficult) : [],
      easy: storedEasy ? JSON.parse(storedEasy) : [],
      fontSize: storedFontSize || 'medium',
      theme: storedTheme || 'light'
    };
  };

  const initialSettings = loadStoredSettings();

  // 初期値としてローカルストレージの値を使用
  const [easyPronunciations, setEasyPronunciations] = useState<string[]>(initialSettings.easy);
  const [difficultPronunciations, setDifficultPronunciations] = useState<string[]>(initialSettings.difficult);
  const [fontSize, setFontSize] = useState<string>(initialSettings.fontSize);
  const [theme, setTheme] = useState<string>(initialSettings.theme);

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

  // 文字サイズのCSS クラスマッピング
  const fontSizeClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
    xlarge: 'text-xl'
  };

  // テーマクラスの適用
  const themeClasses = theme === 'dark' 
    ? 'min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white'
    : 'min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50';

  return (
    <div className={`${themeClasses} ${fontSizeClasses[fontSize as keyof typeof fontSizeClasses] || 'text-base'}`}>
      <NavBar
        onPreferencesClick={() => setShowPreferences(true)}
        apiConnected={apiConnected}
        theme={theme}
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
          theme={theme}
        />
      </main>

      {/* 設定モーダル */}
      <PreferencesModal
        show={showPreferences}
        onHide={() => setShowPreferences(false)}
        onSave={(easyPronunciations, difficultPronunciations, fontSize, theme) => {
          setEasyPronunciations(easyPronunciations);
          setDifficultPronunciations(difficultPronunciations);
          setFontSize(fontSize);
          setTheme(theme);
          setShowPreferences(false);
        }}
      />
    </div>
  );
}

export default App; 