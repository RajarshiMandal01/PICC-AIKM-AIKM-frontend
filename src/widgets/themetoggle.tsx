import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../contexts/theme.context";

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      aria-pressed={theme === "dark"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggleTheme}
      className="inline-flex items-center justify-center p-2 rounded text-gray-200 hover:text-[#5bc0de] focus:outline-none transition-colors cursor-pointer"
    >
      {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
};

export default ThemeToggle;
