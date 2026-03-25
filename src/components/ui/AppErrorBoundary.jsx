import { Component } from "react";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Error inesperado" };
  }

  componentDidCatch(error) {
    console.error("App runtime error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-error-screen">
          <div className="glass-card app-error-card">
            <h2>Se produjo un error al renderizar la app</h2>
            <p>{this.state.message}</p>
            <button
              className="primary-btn"
              onClick={() => globalThis.location.reload()}
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
