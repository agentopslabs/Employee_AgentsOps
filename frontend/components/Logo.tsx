import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
  isDarkBg?: boolean;
}

export default function Logo({ className = "", size = 32, isDarkBg = false }: LogoProps) {
  // Use the exact Navy Blue and Gold Yellow colors from the company logo
  const navyColor = isDarkBg ? "#FFFFFF" : "#0A2540";
  const goldColor = "#F1B814";

  return (
    <div className={`flex items-center gap-3 font-bold tracking-tight select-none ${className}`}>
      {/* High-Fidelity Custom AgentOps Vector Brand Mark SVG matching Image 2 */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0 animate-fade-in"
      >
        {/* Slanted Delta/Lambda Arch resembling 'A' */}
        <path
          d="M48.5 8C46.2 8 44.1 9.3 43.1 11.4L13.8 73.1C11.6 77.8 15.0 83.2 20.2 83.2H42.5C45.3 83.2 47.8 81.7 49.2 79.2L58.2 63.5L50.5 47.9L46.8 55.4C45.8 57.4 43.8 58.7 41.6 58.7H33.5L50.5 22.9L64.5 52.4C64.6 52.5 64.7 52.7 64.8 52.9C65.2 53.6 65.4 54.4 65.4 55.2C65.4 57.3 64.3 59.3 62.4 60.3L54.7 64.4C52.7 65.5 51.5 67.6 51.5 69.9V75.6C51.5 78.4 53.8 80.7 56.6 80.7H65.8C68.6 80.7 70.9 78.4 70.9 75.6V73.1L58.0 46.2L48.5 26.2L44.8 18.5C44.4 17.6 44.4 16.6 44.8 15.7L48.5 11.4C49.5 9.3 48.5 8 48.5 8Z"
          fill={navyColor}
        />
        {/* Overlapping circle and lower arch matching AgentOps 'O' structure */}
        <path
          d="M78.5 28C63.9 28 52 39.9 52 54.5C52 61.8 55 68.4 59.8 73.1C60.6 73.9 61.9 73.9 62.7 73.1L68.8 67.0C69.6 66.2 69.6 64.9 68.8 64.1C66.8 62.1 65.6 59.4 65.6 56.3C65.6 51.4 69.6 47.4 74.5 47.4C79.4 47.4 83.4 51.4 83.4 56.3C83.4 59.4 82.2 62.1 80.2 64.1C79.4 64.9 79.4 66.2 80.2 67.0L86.3 73.1C87.1 73.9 88.4 73.9 89.2 73.1C94 68.4 97 61.8 97 54.5C97 39.9 85.1 28 70.5 28H78.5Z"
          fill={goldColor}
        />
        {/* Inner lower blue support */}
        <path
          d="M59.2 76.2C64.3 80.5 70.8 83 78 83C85.2 83 91.7 80.5 96.8 76.2L91.2 69.7C87.6 72.8 83 74.5 78 74.5C73 74.5 68.4 72.8 64.8 69.7L59.2 76.2Z"
          fill={navyColor}
        />
        {/* Overlapping small gold triangle */}
        <path
          d="M34.5 76.2L42.5 61.2L50.5 76.2H34.5Z"
          fill={goldColor}
        />
      </svg>

      {/* Styled Brand Text precisely matching Logo components */}
      <span className="text-lg font-bold tracking-tight flex items-center">
        <span style={{ color: navyColor }}>Agent</span>
        <span style={{ color: goldColor }}>Ops</span>
        <span className={`text-[10px] font-semibold uppercase tracking-widest ml-1 opacity-70 ${isDarkBg ? "text-slate-300" : "text-slate-400"}`}>
          Labs
        </span>
      </span>
    </div>
  );
}
