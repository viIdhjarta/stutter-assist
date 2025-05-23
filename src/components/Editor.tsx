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
}

interface EditorProps {
  hardWords: string[];
  onAddEasyWord: (word: string) => void;
  onAddDifficultWord: (word: string) => void;
  userEasyWords?: string[]; // ユーザーが簡単と設定した単語
  userDifficultWords?: string[]; // ユーザーが難しいと設定した単語
  easyPronunciations?: string[]; // ユーザーが簡単な音のリスト
  difficultPronunciations?: string[]; // ユーザーが苦手な音のリスト
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
      setPopoverPosition({
        top: window.scrollY + 20,
        left: window.scrollX - 45
      });
      setShowPopover(!showPopover); // クリックするたびに表示・非表示を切り替え
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
      className="highlight"
      onClick={handleClick}
      style={{ backgroundColor: '#FFEB3B', cursor: 'pointer', padding: '0 1px' }}
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
}

// 難しい単語を検出するストラテジー
type DecoratorStrategy = (
  contentBlock: ContentBlock,
  callback: (start: number, end: number) => void,
  contentState: ContentState
) => void;

// 形態素解析された単語位置に基づいてハイライトするストラテジー
const createDifficultWordStrategy = (difficultWords: DifficultWordInfo[]): DecoratorStrategy => {
  return (contentBlock, callback) => {
    const text = contentBlock.getText();

    // 現在のブロックに属するdifficultWords内の単語を取得
    difficultWords.forEach(wordInfo => {
      // APIから返された開始・終了位置を直接使用
      if (wordInfo.start !== undefined && wordInfo.end !== undefined) {
        // テキスト内の位置が現在のブロック内にある場合のみコールバックを呼び出す
        const blockStart = text.indexOf(wordInfo.word);
        if (blockStart !== -1) {
          callback(blockStart, blockStart + wordInfo.word.length);
        }
      }
    });
  };
};

const Editor: React.FC<EditorProps> = ({
  onAddEasyWord,
  userDifficultWords = [],
  easyPronunciations = [],
  difficultPronunciations = []
}) => {
  // 難しい単語のリスト（APIから取得）
  const [hardWords, setHardWords] = useState<DifficultWordInfo[]>([]);
  const [currentText, setCurrentText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  
  
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
        strategy: createDifficultWordStrategy(hardWords),
        component: (props: any) => (
          <DifficultWordSpan
            {...props}
            currentText={currentText}
            onSelectAlternative={(alternative: string) => {
              if (alternative === 'ignore') {
                onAddEasyWord(props.decoratedText);
              } else {
                // 単語を代替案で置き換える処理
                replaceWord(props.decoratedText, alternative, props.blockKey, props.start, props.end);
              }
            }}
          />
        ),
      },
    ]);
  }, [hardWords, onAddEasyWord, replaceWord, currentText]);

  const [editorState, setEditorState] = useState<EditorState>(() => {
    // 初期状態
    const initialText = '吃音症は何百万人もの人々の個人的および職業的生活に影響を与える言語障害です。スティグマや恥ずかしさから身を守るために、吃音のある人々(PWS)はさまざまな戦略を採用して吃音を隠すことがあります。一般的な戦略の一つは単語の置き換えです。';
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
      console.log('苦手な音リスト:', difficultPronunciations);
      const response = await analyzeRealtime(text, easyPronunciations, difficultPronunciations);

      // APIレスポンスの詳細をデバッグ表示
      console.log('APIレスポンス全体:', response);


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

        // 「吃音」を含む難しい単語のデバッグ出力
        const kitsuonWords = response.words.filter((item: any) => item.word.includes('吃音'));
        if (kitsuonWords.length > 0) {
          console.log('「吃音」を含む難しい単語:', kitsuonWords);
          console.log('「吃音」の読み:', kitsuonWords.map((w: any) => w.reading));
        }
      }
    } catch (error) {
      console.error('テキスト分析エラー:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [userDifficultWords, isAnalyzing, difficultPronunciations]);

  // デバウンス処理を行ったテキスト分析関数
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedAnalyzeText = useCallback(
    debounce((text: string) => {
      analyzeText(text);
    }, DEBOUNCE_TIME),
    [analyzeText]
  );

  // エディターの内容が変更されたときのハンドラー
  const handleEditorChange = (newEditorState: EditorState): void => {
    const newContentState = newEditorState.getCurrentContent();
    const oldContentState = editorState.getCurrentContent();

    // 内容が変わった場合のみ処理
    if (newContentState !== oldContentState) {
      // 新しいテキストを取得
      const newText = newContentState.getPlainText();
      setCurrentText(newText);

      // 一定時間後にテキスト分析を実行
      debouncedAnalyzeText(newText);
    }

    setEditorState(newEditorState);
  };

  // hardWordsが変更されたときにデコレーターを更新
  useEffect(() => {
    setEditorState(currentState =>
      EditorState.set(currentState, { decorator: createDecorator() })
    );
  }, [hardWords, createDecorator]);

  return (
    <div className="editor-container" style={{ position: 'relative' }}>
      <div className="editor-header" style={{ marginBottom: '10px' }}>
        <h4>エディタ</h4>
        {isAnalyzing && <span style={{ color: '#888', fontSize: '14px', marginLeft: '10px' }}>分析中...</span>}
      </div>

      <div className="editor-wrapper " style={{ border: '1px solid #ccc', padding: '10px', minHeight: '150px', minWidth: '150%' }}>
        <DraftEditor
          editorState={editorState}
          onChange={handleEditorChange}
          placeholder="文章を入力してください..."
        />
      </div>
    </div>
  );
};

export default Editor; 