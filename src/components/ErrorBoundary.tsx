import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);
    
    // Update state with error information
    this.setState({
      error,
      errorInfo
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send error to external logging service (optional)
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // Here you could send errors to services like Sentry, LogRocket, etc.
    // For now, we'll just log to console and localStorage
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent
      };

      // Store in localStorage for debugging
      const existingLogs = JSON.parse(localStorage.getItem('error_logs') || '[]');
      existingLogs.push(errorLog);
      
      // Keep only last 10 errors to prevent storage bloat
      if (existingLogs.length > 10) {
        existingLogs.shift();
      }
      
      localStorage.setItem('error_logs', JSON.stringify(existingLogs));
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  };

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-500 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Something went wrong</h1>
            </div>
            
            <p className="text-gray-600 mb-4">
              We're sorry, but something unexpected happened. Our team has been notified.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-gray-50 rounded-md p-4 mb-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Error Details:</h3>
                <p className="text-sm text-red-600 mb-2">{this.state.error.message}</p>
                {this.state.errorInfo && (
                  <details className="text-xs text-gray-600">
                    <summary className="cursor-pointer mb-2">Stack Trace</summary>
                    <pre className="overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={this.resetError}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Async Error Boundary for handling promise rejections
 */
export class AsyncErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  componentDidMount() {
    // Listen for unhandled promise rejections
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Convert rejection to error for error boundary
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));
    
    this.setState({
      hasError: true,
      error,
      errorInfo: { componentStack: 'Unhandled promise rejection' } as ErrorInfo
    });

    // Prevent default browser error handling
    event.preventDefault();
  };

  render() {
    return <ErrorBoundary {...this.props} />;
  }
}

/**
 * Hook for catching errors in functional components
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((error: Error | string) => {
    if (error instanceof Error) {
      setError(error);
    } else {
      setError(new Error(String(error)));
    }
  }, []);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  return { error, handleError, resetError };
}

/**
 * Global error handler for window errors
 */
export function initializeGlobalErrorHandlers() {
  // Handle JavaScript errors
  window.addEventListener('error', (event) => {
    console.error('Global error caught:', event.error);
    
    // Log to localStorage
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        message: event.error?.message || 'Unknown error',
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        url: window.location.href
      };

      const existingLogs = JSON.parse(localStorage.getItem('error_logs') || '[]');
      existingLogs.push(errorLog);
      
      if (existingLogs.length > 10) {
        existingLogs.shift();
      }
      
      localStorage.setItem('error_logs', JSON.stringify(existingLogs));
    } catch (loggingError) {
      console.error('Failed to log global error:', loggingError);
    }
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Log to localStorage
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        message: String(event.reason),
        stack: event.reason?.stack,
        url: window.location.href,
        type: 'unhandledrejection'
      };

      const existingLogs = JSON.parse(localStorage.getItem('error_logs') || '[]');
      existingLogs.push(errorLog);
      
      if (existingLogs.length > 10) {
        existingLogs.shift();
      }
      
      localStorage.setItem('error_logs', JSON.stringify(existingLogs));
    } catch (loggingError) {
      console.error('Failed to log promise rejection:', loggingError);
    }
  });
}