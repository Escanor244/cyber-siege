// Last line of defence: if any screen crashes, show a recovery panel instead of
// a blank page, and let the player get back to the menu without refreshing.
import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[cyber-siege] UI crashed:", error, info?.componentStack);
  }

  recover = () => {
    try {
      sessionStorage.removeItem("cybersiege_active_room");
    } catch {
      /* storage unavailable */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="modal-overlay" role="alertdialog" aria-labelledby="crash-title">
        <div className="modal-container modal-loss">
          <h2 id="crash-title" className="modal-title">
            SYSTEM GLITCH
          </h2>
          <p className="modal-subtitle">Something went wrong on this screen. Your progress on the server is safe.</p>
          <div className="modal-actions">
            <button type="button" className="action-primary-btn" onClick={this.recover}>
              RETURN TO MENU
            </button>
          </div>
        </div>
      </div>
    );
  }
}
