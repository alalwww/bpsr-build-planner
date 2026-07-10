import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// アプリ全体のクラッシュ防止用の最終防波堤。i18n・ストア等、他の仕組みが壊れていても
// 表示できるよう、依存を持たずインラインスタイルのみで完結させる。
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled error in BuildPlanner:', error, info.componentStack);
  }

  handleReload = (): void => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          height: '100%',
          padding: 24,
          textAlign: 'center',
          color: '#e0e0e8',
          background: '#1c1c24',
        }}
      >
        <p style={{ fontSize: 16, margin: 0 }}>
          予期しないエラーが発生しました。
          <br />
          An unexpected error has occurred.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            padding: '8px 20px',
            fontSize: 14,
            color: '#1c1c24',
            background: '#e0e0e8',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          再読み込み / Reload
        </button>
      </div>
    );
  }
}
