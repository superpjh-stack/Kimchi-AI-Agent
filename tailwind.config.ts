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
          red: "#D62828",
          "red-dark": "#A51D1D",
          "red-light": "#E85D5D",
          green: "#2A9D8F",
          "green-dark": "#1F7A6E",
          "green-light": "#52B788",
          orange: "#F77F00",
          "orange-light": "#FCBF49",
          beige: "#F5E6CA",
          "beige-dark": "#EAD2AC",
          cream: "#FFF8F0",
        },
        brand: {
          primary: "#D62828",
          secondary: "#2A9D8F",
          accent: "#F77F00",
          warm: "#F4A261",
          background: "#FFF8F0",
          surface: "#FFFFFF",
          border: "#EAD2AC",
          "text-primary": "#2D1810",
          "text-secondary": "#6B4F3A",
          "text-muted": "#A8907A",
        },
        chat: {
          user: "#D62828",
          "user-light": "#FDE8E8",
          assistant: "#FFF8F0",
          "assistant-border": "#EAD2AC",
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
        "float": "float 3s ease-in-out infinite",
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
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
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
