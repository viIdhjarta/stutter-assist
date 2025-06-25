import React, { forwardRef, Ref, MouseEvent, useState, useEffect } from 'react';
import { getSmartAlternatives } from '../services/apiService';

interface WordPopoverProps {
  word: string;
  position: {
    top: number;
    left: number;
  };
  currentText: string;
  textPosition: {
    start: number;
    end: number;
  };
  onSelect: (alternative: string) => void;
  onIgnore: () => void;
  onMouseEnter?: (e: MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: MouseEvent<HTMLDivElement>) => void;
  easyPronunciations?: string[];  // ユーザーが発音しやすい音のリスト
}

const WordPopover = forwardRef((
  { word, position, currentText, textPosition, onSelect, onIgnore, onMouseEnter, onMouseLeave, easyPronunciations }: WordPopoverProps,
  ref: Ref<HTMLDivElement>
) => {
  const [alternatives, setAlternatives] = useState<{word: string, reading?: string}[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const getContextWindow = (text: string, start: number, end: number, windowSize: number) => {
    const beforeStart = Math.max(0, start - windowSize);
    const afterEnd = Math.min(text.length, start + windowSize);
    const beforeContext = text.slice(beforeStart, start).trim();
    const afterContext = text.slice(end, afterEnd).trim();
    return { beforeContext, afterContext };
  };

  // カタカナをひらがなに変換する簡易関数
  const katakanaToHiragana = (str: string): string => {
    return str.replace(/[\u30A1-\u30F6]/g, (match) => {
      const char = match.charCodeAt(0) - 0x60;
      return String.fromCharCode(char);
    });
  };

  // 発音しやすい音から始まるかどうかを判定する関数
  const isEasyPronunciation = (word: string, reading?: string | null): boolean => {
    if (!easyPronunciations || easyPronunciations.length === 0) {
      return false;
    }
    
    console.log('Checking word:', word, 'reading:', reading, 'against easyPronunciations:', easyPronunciations);
    
    // 読み情報がある場合は読みの最初の文字で判定、ない場合は単語の最初の文字で判定
    const checkChar = reading ? reading.charAt(0) : word.charAt(0);
    
    // カタカナをひらがなに変換して比較
    const hiraganaCheckChar = katakanaToHiragana(checkChar);
    
    const result = easyPronunciations.includes(checkChar) || easyPronunciations.includes(hiraganaCheckChar);
    
    console.log(`Word: "${word}", Check char: "${checkChar}", Hiragana: "${hiraganaCheckChar}", Is easy: ${result}`);
    return result;
  };

  useEffect(() => {
    const fetchAlternatives = async () => {
      try {
        setLoading(true);
        console.log('WordPopover: easyPronunciations received:', easyPronunciations);
        const { beforeContext, afterContext } = getContextWindow(
          currentText,
          textPosition.start,
          textPosition.end,
          250
        );
        const contextText = beforeContext + word + afterContext;
        console.log('contextText', beforeContext, word, afterContext);
        const result = await getSmartAlternatives(contextText, word, easyPronunciations);
        console.log('API result:', result);
        
        if (result && result.alternatives && Array.isArray(result.alternatives)) {
          console.log('Setting alternatives:', result.alternatives);
          // 代替案を統一した形式に変換
          const processedAlternatives = result.alternatives.map(alt => ({
            word: typeof alt === 'string' ? alt : alt.word,
            reading: typeof alt === 'object' && alt.reading ? alt.reading : undefined
          }));
          setAlternatives(processedAlternatives);
          
          // 各代替案の発音しやすさをチェック
          processedAlternatives.forEach(alt => {
            const isEasy = isEasyPronunciation(alt.word, alt.reading);
            console.log(`Alternative "${alt.word}" (reading: ${alt.reading}): isEasy = ${isEasy}`);
          });
        } else {
          setAlternatives([]);
        }
      } catch (err) {
        console.error('代替案の取得に失敗しました', err);
        setError('代替案を取得できませんでした');
      } finally {
        setLoading(false);
      }
    };

    fetchAlternatives();
  }, [word, currentText, textPosition, easyPronunciations]);

  const handleSelect = (alternative: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    onSelect(alternative);
  };

  const handleIgnore = (e: React.MouseEvent): void => {
    e.stopPropagation();
    onSelect('ignore');
    onIgnore();
  };

  return (
    <div
      ref={ref}
      className="fixed z-50 w-44 bg-white rounded-md shadow-lg border border-gray-100 overflow-hidden"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      {loading ? (
        <div className="py-2 px-3 text-center text-gray-500 text-xs">
          <div className="flex justify-center items-center space-x-1">
            <div className="animate-pulse h-1.5 w-1.5 bg-gray-400 rounded-full"></div>
            <div className="animate-pulse h-1.5 w-1.5 bg-gray-400 rounded-full animation-delay-200"></div>
            <div className="animate-pulse h-1.5 w-1.5 bg-gray-400 rounded-full animation-delay-400"></div>
          </div>
        </div>
      ) : error ? (
        <div className="py-2 px-3 text-center text-red-500 text-xs">
          {error}
        </div>
      ) : alternatives.length === 0 ? (
        <div className="py-2 px-3 text-center text-gray-500 text-xs">
          代替案がありません
        </div>
      ) : (
        <div className="max-h-48 overflow-y-auto">
          <ul className="divide-y divide-gray-50">
            {alternatives.map((alt, index) => {
              const isEasy = isEasyPronunciation(alt.word, alt.reading);
              return (
                <li
                  key={index}
                  onClick={(e) => handleSelect(alt.word, e)}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={`px-3 py-1.5 text-xs cursor-pointer transition-colors duration-150 ${
                    isEasy 
                      ? (hoveredIndex === index 
                         ? 'bg-green-100 text-green-700 border-l-2 border-green-400' 
                         : 'bg-green-50 text-green-600 border-l-2 border-green-300 hover:bg-green-100')
                      : (hoveredIndex === index 
                         ? 'bg-blue-50 text-blue-600' 
                         : 'text-gray-700 hover:bg-gray-50')
                  }`}
                >
                  {isEasy && (
                    <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                  )}
                  {alt.word}
                </li>
              );
            })}
            <li
              onClick={handleIgnore}
              onMouseEnter={() => setHoveredIndex(-1)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`px-3 py-1.5 text-xs cursor-pointer transition-colors duration-150
                ${hoveredIndex === -1 ? 'bg-gray-50 text-gray-500' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-500'}`}
            >
              無視
            </li>
          </ul>
        </div>
      )}
    </div>
  );
});

// React 19 will deprecate forwardRef, but we're using it for now
WordPopover.displayName = 'WordPopover';

export default WordPopover;
