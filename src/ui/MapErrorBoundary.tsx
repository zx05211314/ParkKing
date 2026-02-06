import { Component } from 'react'
import type { ReactNode } from 'react'

interface MapErrorBoundaryProps {
  children: ReactNode
  onRetry: () => void
  resetKey: number
}

interface MapErrorBoundaryState {
  error: Error | null
}

export class MapErrorBoundary extends Component<
  MapErrorBoundaryProps,
  MapErrorBoundaryState
> {
  state: MapErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidUpdate(prevProps: MapErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  handleRetry = () => {
    this.setState({ error: null })
    this.props.onRetry()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="map-fallback">
          <div className="map-fallback-title">Map failed to load</div>
          <div className="map-fallback-body">
            Check your connection and retry loading the map.
          </div>
          <div className="map-fallback-actions">
            <button type="button" className="sheet-close" onClick={this.handleRetry}>
              Retry map
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
