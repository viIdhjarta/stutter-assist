import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Editor as DraftEditor, EditorState, ContentState, CompositeDecorator, Modifier, SelectionState, ContentBlock } from 'draft-js';
import 'draft-js/dist/Draft.css';
import WordPopover from './WordPopover';
import { analyzeRealtime } from '../services/apiService';
import debounce from 'lodash/debounce';

interface DifficultWordSpanProps {
  decoratedText: string;
  blockKey: string;
  start: number;
  end: number;
  children: React.ReactNode;
  currentText: string; // 現在のエディタのテキスト全体
  onSelectAlternative: (alternative: string) => void;
  contentState: ContentState;
  easyPronunciations?: string[]; // ユーザーが発音しやすい音のリスト
}

interface EditorProps {
  hardWords: string[];
  onAddEasyWord: (word: string) => void;
  onAddDifficultWord: (word: string) => void;
  userEasyWords?: string[]; // ユーザーが簡単と設定した単語
  userDifficultWords?: string[]; // ユーザーが難しいと設定した単語
  easyPronunciations?: string[]; // ユーザーが簡単な音のリスト
  difficultPronunciations?: string[]; // ユーザーが苦手な音のリスト
  theme?: string; // テーマ設定
}

// デバウンス時間（ミリ秒）
const DEBOUNCE_TIME = 500;

const getAbsoluteOffset = (contentState: ContentState, blockKey: string, offsetInBlock: number): number => {
  const blocks = contentState.getBlocksAsArray();
  let absoluteOffset = 0;

  for (const block of blocks) {
    if (block.getKey() === blockKey) {
      // 目的のブロックに到達したら、そこまでの累積オフセットに
      // ブロック内のオフセットを加算して返す
      return absoluteOffset + offsetInBlock;
    }
    // 各ブロックの長さを加算（改行文字は含めない）
    absoluteOffset += block.getLength() + 1;
  }
  return absoluteOffset;
};

// 難しい単語をハイライトするスパンコンポーネント
const DifficultWordSpan: React.FC<DifficultWordSpanProps> = (props) => {
  const [showPopover, setShowPopover] = useState<boolean>(false);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const spanRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleClick = (): void => {
    if (spanRef.current) {
      const rect = spanRef.current.getBoundingClientRect();
      
      const position = {
        top: rect.bottom + 5, // ビューポートからの相対位置 + 5px余白
        left: rect.left - 20  // ビューポートからの相対位置 - 20px（少し左にずらす）
      };
      
      console.log('Clicked word:', props.decoratedText, 'Position:', position, 'Rect:', rect);
      setPopoverPosition(position);
      setShowPopover(!showPopover);
    }
  };


  // ポップオーバー外のクリックを検知してポップオーバーを閉じるためのハンドラ
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showPopover &&
        spanRef.current &&
        popoverRef.current &&
        !spanRef.current.contains(event.target as Node) &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setShowPopover(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopover]);

  const handleSelectAlternative = (alternative: string): void => {
    // 代替案を選択した後にポップアップを閉じる
    setShowPopover(false);
    // ポップオーバーの状態を更新するために非同期にする
    setTimeout(() => {
      // 親コンポーネントに選択した代替案を通知
      props.onSelectAlternative(alternative);
    }, 0);
  };

  // contentStateはデコレーターから提供されるpropsに含まれます
  const contentState = props.contentState;

  // 文書全体での絶対位置を計算
  const absoluteStart = getAbsoluteOffset(contentState, props.blockKey, props.start);
  const absoluteEnd = getAbsoluteOffset(contentState, props.blockKey, props.end);

  return (
    <span
      ref={spanRef}
      onClick={handleClick}
      className="highlight bg-yellow-200 hover:bg-yellow-300 cursor-pointer px-1 rounded-sm transition-colors duration-200 shadow-sm"
    >
      {props.children}
      {showPopover && (
        <WordPopover
          ref={popoverRef}
          word={props.decoratedText}
          position={popoverPosition}
          currentText={props.currentText}
          textPosition={{
            start: absoluteStart,
            end: absoluteEnd
          }}
          onSelect={handleSelectAlternative}
          onIgnore={() => setShowPopover(false)}
          easyPronunciations={props.easyPronunciations}
        />
      )}
    </span>
  );
};

// 難しい単語の情報を保持する型
interface DifficultWordInfo {
  word: string;
  start: number;
  end: number;
  blockKey?: string;
  reason?: string;
  reading?: string;
}

// 難しい単語を検出するストラテジー
type DecoratorStrategy = (
  contentBlock: ContentBlock,
  callback: (start: number, end: number) => void,
  contentState: ContentState
) => void;

// 文書全体での絶対位置からブロック内相対位置を計算する関数（改良版）
const getBlockRelativePosition = (contentState: ContentState, absoluteStart: number, absoluteEnd: number, targetBlockKey: string): { start: number; end: number } | null => {
  const blocks = contentState.getBlocksAsArray();
  let currentOffset = 0;
  
  for (const block of blocks) {
    const blockLength = block.getLength();
    const blockStart = currentOffset;
    const blockEnd = currentOffset + blockLength;
    
    // 単語がこのブロック内にある場合（境界チェックを改善）
    if (block.getKey() === targetBlockKey) {
      const relativeStart = Math.max(0, absoluteStart - blockStart);
      const relativeEnd = Math.min(blockLength, absoluteEnd - blockStart);
      
      // 有効な範囲内かチェック
      if (relativeStart >= 0 && relativeEnd <= blockLength && relativeStart < relativeEnd) {
        return {
          start: relativeStart,
          end: relativeEnd
        };
      }
    }
    
    currentOffset = blockEnd + 1; // 改行文字を考慮
  }
  
  return null;
};

// 形態素解析された単語位置に基づいてハイライトするストラテジー
const createDifficultWordStrategy = (difficultWords: DifficultWordInfo[], ignoredWords: string[]): DecoratorStrategy => {
  return (contentBlock, callback, contentState) => {
    const blockKey = contentBlock.getKey();

    // 現在のブロックに属する難しい単語を検出
    difficultWords.forEach(wordInfo => {
      // 無視された単語はハイライト対象から除外
      if (ignoredWords.includes(wordInfo.word)) {
        return;
      }

      // APIから返された絶対位置を使用
      if (wordInfo.start !== undefined && wordInfo.end !== undefined) {
        const blockPosition = getBlockRelativePosition(contentState, wordInfo.start, wordInfo.end, blockKey);
        
        if (blockPosition) {
          callback(blockPosition.start, blockPosition.end);
        }
      }
    });
  };
};

const Editor: React.FC<EditorProps> = ({
  onAddEasyWord,
  userDifficultWords = [],
  easyPronunciations = [],
  difficultPronunciations = [],
  theme = 'light'
}) => {
  // 難しい単語のリスト（APIから取得）
  const [hardWords, setHardWords] = useState<DifficultWordInfo[]>([]);
  const [currentText, setCurrentText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  // 無視された単語のリスト
  const [ignoredWords, setIgnoredWords] = useState<string[]>([]);


  // 単語を置き換える関数
  const replaceWord = useCallback((oldWord: string, newWord: string, blockKey: string, start: number, end: number): void => {
    // 指定された単語の位置を基にSelectionStateを作成
    const selection = SelectionState.createEmpty(blockKey).merge({
      anchorOffset: start,
      focusOffset: end,
    });

    // 単語を置き換える新しいコンテンツステートを作成
    setEditorState(currentEditorState => {
      const contentState = currentEditorState.getCurrentContent();
      const newContentState = Modifier.replaceText(
        contentState,
        selection,
        newWord
      );

      // 新しいEditorStateを作成して設定
      const newEditorState = EditorState.push(
        currentEditorState,
        newContentState,
        'insert-characters'
      );

      // 現在のデコレーターを取得して新しいEditorStateに適用
      const currentDecorator = currentEditorState.getDecorator();
      const stateWithDecorator = EditorState.set(newEditorState, { decorator: currentDecorator });

      // カーソル位置を置換後の単語の後ろに設定
      const newSelection = SelectionState.createEmpty(blockKey).merge({
        anchorOffset: start + newWord.length,
        focusOffset: start + newWord.length,
      });
      const stateWithSelection = EditorState.forceSelection(stateWithDecorator, newSelection);

      console.log(`${oldWord} を ${newWord} に置き換えました`);
      setCurrentText(stateWithSelection.getCurrentContent().getPlainText());
      return stateWithSelection;
    });
  }, []);

  // デコレーターを作成する関数
  const createDecorator = useCallback((): CompositeDecorator => {
    return new CompositeDecorator([
      {
        strategy: createDifficultWordStrategy(hardWords, ignoredWords),
        component: (props: any) => (
          <DifficultWordSpan
            {...props}
            currentText={currentText}
            easyPronunciations={easyPronunciations}
            onSelectAlternative={(alternative: string) => {
              if (alternative === 'ignore') {
                onAddEasyWord(props.decoratedText);
                // 無視リストに追加
                setIgnoredWords(prev => [...prev, props.decoratedText]);
              } else {
                // 単語を代替案で置き換える処理
                replaceWord(props.decoratedText, alternative, props.blockKey, props.start, props.end);
              }
            }}
          />
        ),
      },
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hardWords, ignoredWords, easyPronunciations]);

  const [editorState, setEditorState] = useState<EditorState>(() => {
    // 初期状態
    const initialText = "トランプ氏の２３日の説明によると、双方の攻撃停止を取り決めた停戦合意は２４日に発効。合意発効から２４時間が経過した日本時間２５日午後１時に「戦争が正式に終結する」としていた。合意発効の発表後は当初、攻撃の応酬があったが、ＡＰ通信などは「停戦は維持されている」と報じている。米国のスティーブン・ウィトコフ中東担当特使は２４日、米ＦＯＸニュースのインタビューで、「トランプ氏は、（イランと）『包括的な和平合意』を望んでいる」と明らかにした。長期的な和平が実現すれば、イランの繁栄や湾岸諸国の経済成長につながると訴えた。合意発効を受け、イスラエルのベンヤミン・ネタニヤフ首相とイランのマスード・ペゼシュキアン大統領は２４日、国民向けのメッセージをそれぞれ発出した。ネタニヤフ氏は、ＳＮＳに投稿したビデオ演説で、「この勝利は、後世に語り継がれる」と強調。「我々は核爆弾と２万発のミサイルによる脅威を取り除いた」とイランに対する攻撃の成果を説明した。次の狙いとして、イスラム主義組織ハマスを挙げ、パレスチナ自治区ガザに拘束されている人質の解放に再び取り組む考えも示した。一方、ペゼシュキアン氏は国営テレビで、「イランの人々の勇敢で歴史的な忍耐の末、イスラエルによって強要された１２日間の戦争が終結した」と述べた。イスラエルについては「（イランの）核施設を破壊し、社会不安を扇動するという悪質な目的を達成できなかった」と強調した。";
    setCurrentText(initialText);
    return EditorState.createWithContent(
      ContentState.createFromText(initialText),
      createDecorator()
    );
  });

  // リアルタイム分析のための関数
  const analyzeText = useCallback(async (text: string) => {
    if (!text || text.trim() === '' || isAnalyzing) return;

    try {
      setIsAnalyzing(true);

      // Propsから渡された苦手な音のリストを使用
      const response = await analyzeRealtime(text, easyPronunciations, difficultPronunciations);


      // 形態素解析結果の保存
      if (response && response.morphemes && Array.isArray(response.morphemes)) {

        // 「吃音」を含む形態素を特に確認
        const kitsuonMorphemes = response.morphemes.filter((m: any) => m.surface.includes('吃音'));
        console.log('「吃音」を含む形態素:', kitsuonMorphemes);

        // 「き」で始まる読みを持つ形態素を確認
        const kiMorphemes = response.morphemes.filter((m: any) =>
          m.reading && (m.reading.startsWith('キ') || m.reading.startsWith('き'))
        );
        console.log('「き」で始まる読みを持つ形態素:', kiMorphemes);
      }

      // 難しい単語を取得してハードワードリストを更新
      if (response && response.words && Array.isArray(response.words)) {
        // 位置情報付きの難しい単語のリストを作成
        const difficultWords = response.words.map((item: any) => ({
          word: item.word,
          start: item.start,
          end: item.end,
          reason: item.reason,
          reading: item.reading
        }));

        setHardWords(difficultWords);
      }
    } catch (error) {
      console.error('テキスト分析エラー:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [userDifficultWords, difficultPronunciations, easyPronunciations]);

  // デバウンス処理を行ったテキスト分析関数
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedAnalyzeText = useCallback(
    debounce((text: string) => {
      analyzeText(text);
    }, DEBOUNCE_TIME),
    [analyzeText]
  );

  // エディターの内容が変更されたときのハンドラー（改良版）
  const handleEditorChange = (newEditorState: EditorState): void => {
    const newContentState = newEditorState.getCurrentContent();
    const oldContentState = editorState.getCurrentContent();

    // 内容が変わった場合のみ処理
    if (newContentState !== oldContentState) {
      // 新しいテキストを取得
      const newText = newContentState.getPlainText();
      
      // エディター状態を先に更新
      setEditorState(newEditorState);
      
      // テキストが変更された場合のみ状態更新と分析を実行
      if (newText !== currentText) {
        setCurrentText(newText);
        // 一定時間後にテキスト分析を実行
        debouncedAnalyzeText(newText);
      }
    } else {
      // 内容が変わらない場合（選択変更など）は状態のみ更新
      setEditorState(newEditorState);
    }
  };

  // 初期テキストの分析を実行
  useEffect(() => {
    if (currentText) {
      analyzeText(currentText);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回のみ実行

  // 発音設定が変更されたときに再分析（analyzeTextを依存配列から除外して無限ループを防ぐ）
  useEffect(() => {
    if (currentText && (difficultPronunciations.length > 0 || easyPronunciations.length > 0)) {
      console.log('発音設定が変更されたため再分析します');
      analyzeText(currentText);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultPronunciations, easyPronunciations, currentText]);

  // hardWordsやignoredWordsが変更されたときにデコレーターを更新
  useEffect(() => {
    // isAnalyzing中は更新を避ける（入力競合を防ぐため）
    if (isAnalyzing) return;
    
    const timer = setTimeout(() => {
      setEditorState(currentState => {
        const contentState = currentState.getCurrentContent();
        const plainText = contentState.getPlainText();
        
        // 現在のテキストが空の場合や、状態が不整合な場合は安全に処理
        if (!plainText) {
          return EditorState.createEmpty(createDecorator());
        }
        
        const selectionState = currentState.getSelection();
        
        try {
          // 新しいデコレーターでEditorStateを完全に再構築
          const newEditorState = EditorState.createWithContent(
            contentState,
            createDecorator()
          );
          
          // 選択状態を復元（安全性チェック付き）
          if (selectionState && selectionState.getStartKey() && selectionState.getEndKey()) {
            return EditorState.forceSelection(newEditorState, selectionState);
          } else {
            return newEditorState;
          }
        } catch (error) {
          console.error('デコレーター更新エラー:', error);
          return currentState; // エラー時は現在の状態を維持
        }
      });
    }, 100); // タイミングを短縮して応答性を向上
    
    return () => clearTimeout(timer);
  }, [hardWords, ignoredWords, createDecorator, isAnalyzing]);

  // テーマに応じたスタイリング
  const isDark = theme === 'dark';
  const containerClass = isDark 
    ? "relative max-w-6xl mx-auto p-6"
    : "relative max-w-6xl mx-auto p-6";
  
  const headerTextClass = isDark 
    ? "text-2xl font-bold text-white flex items-center"
    : "text-2xl font-bold text-gray-800 flex items-center";
    
  const analyzingTextClass = isDark 
    ? "flex items-center text-sm text-gray-300"
    : "flex items-center text-sm text-gray-500";
    
  const editorContainerClass = isDark 
    ? "bg-gray-800 rounded-xl shadow-lg border border-gray-600 overflow-hidden"
    : "bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden";
    
  const editorHeaderClass = isDark 
    ? "bg-gradient-to-r from-gray-700 to-gray-600 px-6 py-3 border-b border-gray-600"
    : "bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-3 border-b border-gray-200";
    
  const editorContentClass = isDark 
    ? "p-8 min-h-[400px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-opacity-50 transition-all duration-200 text-white bg-gray-800"
    : "p-8 min-h-[400px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-opacity-50 transition-all duration-200";
    
  const footerTextClass = isDark 
    ? "text-sm text-gray-300"
    : "text-sm text-gray-500";

  return (
    <div className={containerClass}>
      {/* ヘッダー */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className={headerTextClass}>
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Fluent Assist エディタ
            </span>
          </h2>
          {isAnalyzing && (
            <div className={analyzingTextClass}>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
              分析中...
            </div>
          )}
        </div>
        <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
      </div>

      {/* エディタ */}
      <div className={editorContainerClass}>
        <div className={editorHeaderClass}>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-400 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
          </div>
        </div>
        <div className={editorContentClass}>
          <div className={isDark ? 'text-white' : 'text-gray-900'}>
            <DraftEditor
              editorState={editorState}
              onChange={handleEditorChange}
              placeholder="文章を入力してください..."
            />
          </div>
        </div>
      </div>

      {/* フッター情報 */}
      <div className={`mt-4 flex justify-between items-center ${footerTextClass}`}>
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
            ハイライト = 発音困難語
          </span>
          <span>クリックで代替語を表示</span>
        </div>
        <div className="text-xs">
          文字数: {currentText.length}
        </div>
      </div>
    </div>
  );
};

export default Editor; 