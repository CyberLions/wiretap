/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        richblack: '#000814ff',
        yaleblue: '#003566ff',
        argentinianblue: '#5aa9e6ff',
        lightskyblue: '#7fc8f8ff',
        seasalt: '#f9f9f9ff',
        naplesyellow: '#ffe45eff',
        mikadoyellow: '#ffc300ff',
        primary: {
          50: '#f9f9f9ff', // seasalt
          100: '#ffe45eff', // naples yellow
          200: '#ffc300ff', // mikado yellow
          300: '#003566ff', // yale blue
          400: '#5aa9e6ff', // argentinian blue
          500: '#7fc8f8ff', // light sky blue
          600: '#000814ff', // rich black
        },
        success: '#00B4D8',
        warning: '#48CAE4',
        error: '#0077B6',
        info: '#0096C7',
      },
      fontFamily: {
        heading: ['Orbitron', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontWeight: {
        light: 300,
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
} 