import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faCircle } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';

interface NavBarProps {
  onPreferencesClick: () => void;
  apiConnected: boolean;
  theme?: string;
}

const NavBar: React.FC<NavBarProps> = ({ onPreferencesClick, apiConnected, theme = 'light' }) => {
  
  const navTheme = theme === 'dark' 
    ? 'bg-gray-800 shadow-md border-b border-gray-700' 
    : 'bg-white shadow-md border-b border-gray-200';

  return (
    <nav className={navTheme}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* ロゴセクション */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                <span className="text-white font-bold text-sm">FA</span>
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Fluent Assist
              </h1>
            </Link>
          </div>

          {/* ナビゲーションリンク */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <Link
                to="/api-test"
                className={`flex items-center px-4 py-2 rounded-lg transition-colors duration-200 font-medium ${
                  theme === 'dark' 
                    ? 'text-gray-300 hover:bg-gray-700 hover:text-blue-400' 
                    : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                }`}
              >
              </Link>
            </div>
          </div>

          {/* 右側のコントロール */}
          <div className="flex items-center space-x-4">
            {/* API接続状態 */}
            <div className="flex items-center space-x-2">
              <FontAwesomeIcon 
                icon={faCircle} 
                className={`text-xs ${
                  apiConnected ? 'text-green-500' : 'text-red-500'
                } animate-pulse`}
              />
              <span 
                className={`text-sm font-medium ${
                  apiConnected ? 'text-green-700' : 'text-red-700'
                }`}
                title={apiConnected ? 'API接続中' : 'API未接続'}
              >
                {apiConnected ? '接続中' : '未接続'}
              </span>
            </div>

            {/* 設定ボタン */}
            <button
              onClick={onPreferencesClick}
              className={`p-2 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${
                theme === 'dark' 
                  ? 'text-gray-400 hover:text-blue-400 hover:bg-gray-700' 
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
              }`}
              title="設定"
            >
              <FontAwesomeIcon icon={faGear} className="text-lg" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar; 