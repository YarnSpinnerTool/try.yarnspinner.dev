/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Use class-based dark mode, not system preference
  content: [
    "./index.html",
    "./standalone.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderWidth: {
        // 0: "0",
        1: "0.0625rem",
        // 2: "0.125rem"
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.05)' },
        },
        'pulse-attention': {
          '0%, 100%': {
            transform: 'scale(1)',
            boxShadow: '0 0 0 0 rgba(76, 137, 98, 0.7)'
          },
          '50%': {
            transform: 'scale(1.1)',
            boxShadow: '0 0 0 8px rgba(76, 137, 98, 0)'
          },
        },
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'pulse-attention': 'pulse-attention 1.5s ease-in-out infinite',
      },
    },
    colors: {
      white: "#ffffff",

      'black': {
        '50': '#f7f9ec',
        '100': '#ebf1d6',
        '200': '#d9e4b2',
        '300': '#bed284',
        '400': '#a4be5d',
        '500': '#87a33f',
        '600': '#68812f',
        '700': '#516328',
        '800': '#425024',
        'DEFAULT': '#303a1d',
        '900': '#303a1d',
        '950': '#1d250e',
      },

      'grey': {
        '50': '#f5f6f5',
        '100': '#e6e7e6',
        '200': '#d0d1d0',
        '300': '#afb1af',
        '400': '#818582',
        'DEFAULT': '#818582',
        '500': '#6b6f6c',
        '600': '#5b5f5c',
        '700': '#4e504e',
        '800': '#444645',
        '900': '#3c3d3c',
        '950': '#252726',
      },
      'green-pale': {
        '50': '#f6f8f5',
        '100': '#ebf0e8',
        '200': '#d7e1d1',
        'DEFAULT': '#a8bd9b',
        '300': '#a8bd9b',
        '400': '#8fa880',
        '500': '#6e895e',
        '600': '#586f4a',
        '700': '#47593c',
        '800': '#3b4833',
        '900': '#313c2b',
        '950': '#171f14',
      },
      'green': {
        '50': '#f0f5f2',
        '100': '#dce8e2',
        '200': '#bad1c5',
        '300': '#8fb5a3',
        '400': '#6a9a85',
        'DEFAULT': '#4C8962',
        '500': '#4C8962',
        '600': '#3d6d4f',
        '700': '#325740',
        '800': '#2a4635',
        '900': '#243a2d',
        '950': '#122118',
      },
      'blue': {
        '50': '#f2f7f9',
        '100': '#deeaef',
        '200': '#c1d8e0',
        '300': '#96bcca',
        '400': '#79a5b7',
        'DEFAULT': '#79a5b7',
        '500': '#497c91',
        '600': '#3f667b',
        '700': '#385566',
        '800': '#344956',
        '900': '#2f3f4a',
        '950': '#1b2831',
      },
      'green-bright': {
        '50': '#f4faeb',
        '100': '#e7f3d4',
        'DEFAULT': '#c5e29b',
        '200': '#c5e29b',
        '300': '#b2d77f',
        '400': '#94c556',
        '500': '#76aa38',
        '600': '#5a8729',
        '700': '#466724',
        '800': '#3a5321',
        '900': '#334720',
        '950': '#18260d',
      },

      'olive': {
        '50': '#f6f7ee',
        '100': '#ebedda',
        '200': '#d8dcba',
        '300': '#bfc690',
        'DEFAULT': '#a3ad68',
        '400': '#a3ad68',
        '500': '#88944e',
        '600': '#6a743c',
        '700': '#525a31',
        '800': '#43492b',
        '900': '#393f28',
        '950': '#1e2112',
      },


      'red': {
        '50': '#fcf5f0',
        '100': '#f8e8dc',
        '200': '#f0ceb8',
        '300': '#e7ad8a',
        '400': '#dc835b',
        '500': '#d5683f',
        'DEFAULT': '#d5683f',
        '600': '#c64f30',
        '700': '#a43c2a',
        '800': '#843228',
        '900': '#6b2b23',
        '950': '#391511',
      },
      'yellow': {
        '50': '#fef9ec',
        '100': '#fceec9',
        '200': '#f8da8f',
        'DEFAULT': '#f5c45a',
        '300': '#f5c45a',
        '400': '#f2ab2d',
        '500': '#eb8915',
        '600': '#d0660f',
        '700': '#ad4710',
        '800': '#8c3714',
        '900': '#742e13',
        '950': '#421606',
      },
      'pink': {
        '50': '#fdf4f3',
        '100': '#fbe7e5',
        '200': '#f9d4cf',
        'DEFAULT': '#f2a9a0',
        '300': '#f2a9a0',
        '400': '#eb8a7e',
        '500': '#df6354',
        '600': '#cb4737',
        '700': '#aa392b',
        '800': '#8d3227',
        '900': '#762f26',
        '950': '#3f1510',
      },
    },



    // colors: {
    //   "black": "#303a1d",
    //   "grey": {
    //     "DEFAULT": "#818582",
    //     "tint": "#dee2e6",
    //     "tint-light": "#f8f9fa"
    //   },
    //   "olive": "#a3ad68",
    //   "green": {
    //     "dark": "#4c8962",
    //     "DEFAULT": "#7aa479",
    //     "pale": "#a8bd9b",
    //     "bright": "#c5e29b",

    //     "tint-darker": "#afcfbf",
    //     "tint-dark": "#d7e7df",
    //     "tint": "#f6f8f4",

    //   },
    //   "yellow": "#f5c45a",
    //   "red": "#d5683f",
    //   "pink": "#f2a9a0",
    //   "blue": {
    //     "DEFAULT": "#79a5b7",
    //     "tint-dark": "#c9dbe2",
    //     "tint": "#e4edf1",
    //   },
    //   "white": "#ffffff"
    // },



    "fontFamily": {
      "title": ["Space Mono", "monospace"],
      "sans": ["Work Sans", "sans-serif"],
      "serif": ["Georgia", "Cambria", "Times New Roman", "Times", "serif"]
    }
  },
  plugins: [],
}

