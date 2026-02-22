import { Component, ErrorInfo, ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

const STORAGE_KEY = 'tipa_gant_session_v1';

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // no-op, boundary fallback is shown in UI
  }

  private resetState = (): void => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fatal-error">
          <h2>Что-то пошло не так</h2>
          <p>Попробуйте сбросить состояние приложения и перезагрузить страницу.</p>
          <button className="btn" onClick={this.resetState}>Сбросить состояние</button>
        </div>
      );
    }

    return this.props.children;
  }
}
