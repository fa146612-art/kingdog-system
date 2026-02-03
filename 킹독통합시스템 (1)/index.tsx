import React, { ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// 에러 바운더리: 하위 컴포넌트 에러 발생 시 앱 전체가 멈추는 것을 방지
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  public state: ErrorBoundaryState;

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8 text-center font-sans">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-10 border border-gray-100">
            <h1 className="text-3xl font-black text-rose-600 mb-4">앗! 문제가 발생했습니다.</h1>
            <p className="text-gray-600 mb-6 font-bold">
              프로그램 실행 중 오류가 발생하여 화면을 표시할 수 없습니다.<br/>
              잠시 후 다시 시도하거나 페이지를 새로고침 해주세요.
            </p>
            
            <div className="bg-slate-100 p-4 rounded-xl text-left overflow-auto max-h-60 mb-8 border border-slate-200">
              <code className="text-xs text-slate-600 font-mono break-all">
                {this.state.error?.toString() || "Unknown Error"}
              </code>
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 mx-auto"
            >
              🔄 페이지 새로고침
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

console.log("Starting Kingdog App...");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);