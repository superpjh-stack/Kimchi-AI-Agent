import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        kimchi: {
          red: "#E63946",
          "red-dark": "#C1121F",
          "red-light": "#FF6B6B",
          green: "#2A9D8F",
          "green-dark": "#1F7A6E",
          "green-light": "#52B788",
        },
        brand: {
          primary: "#E63946",
          secondary: "#2A9D8F",
          accent: "#F4A261",
          background: "#F8F9FA",
          surface: "#FFFFFF",
          border: "#E9ECEF",
          "text-primary": "#212529",
          "text-secondary": "#6C757D",
          "text-muted": "#ADB5BD",
        },
        chat: {
          user: "#E63946",
          "user-light": "#FDEAEA",
          assistant: "#F1F3F5",
          "assistant-border": "#DEE2E6",
        },
      },
      fontFamily: {
        sans: ["'Noto Sans KR'", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-dot": "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "cursor-blink": "blink 1s step-end infinite",
        "slide-in-left": "slideInLeft 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      screens: {
        xs: "375px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
      },
    },
  },
  plugins: [],
};

export default config;
