"use client";

import React from "react";
import { BRAND } from "@/lib/config";

interface Props {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex items-center justify-center min-h-[200px] p-8"
          style={{ background: BRAND.colors.paper }}
        >
          <div className="text-center">
            <p className="font-display text-[24px] font-bold mb-3" style={{ color: BRAND.colors.ink }}>
              Just a moment
            </p>
            <p className="font-sans text-[14px] mb-6" style={{ color: `${BRAND.colors.ink}99` }}>
              {this.props.fallbackMessage || "Try refreshing the page."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3.5 font-sans font-[700] text-[13px] tracking-[2px] uppercase rounded cursor-pointer border-none"
              style={{ background: BRAND.colors.primary, color: "#fff" }}
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
