import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import App from "./app";
import "./index.css";
createRoot(document.getElementById("root")).render(<StrictMode>
    <BrowserRouter basename="/">
      <ErrorBoundary fallbackRender={({ error }) => (<div className="flex h-screen items-center justify-center p-8 text-center">
            <div>
              <h1 className="mb-2 text-xl font-semibold">Something went wrong</h1>
              <pre className="text-sm text-muted-foreground">{error?.message}</pre>
            </div>
          </div>)}>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>);
