/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      height: {
        'fill-available': '-webkit-fill-available',
        inherit: 'inherit',
      },
      fontFamily: {
        gothic: ['"Century Gothic"', 'sans-serif'],
      },
      letterSpacing: {
        widePt: '0.8pt',
      },
      colors: {
        primary: '#588cf3',           // Calm modern blue
        secondary: '#607d8b',         // Muted Indigo
        accent: '#F97316',            // Soft orange if needed
        muted: '#6B7280',             // Gray-500
        surface: '#F9FAFB',           // Light background
        border: '#E5E7EB',            // Gray-200
        secondary_text: "#efefef"
      },
      // fontFamily: {
      //   heading: ['Poppins', 'sans-serif'],
      //   sans: ['Inter', 'sans-serif'],
      // },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
      },
    },
  },
  plugins: [
     function ({ addUtilities }) {
      addUtilities({
        '.inter-grid-margin': {
          marginTop: '50px', // or whatever value you want
        },
      })
    }
  ],
}
