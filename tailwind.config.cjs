/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        muted: 'var(--color-muted-platinum)',
        background: 'var(--color-background)',
        'on-background': 'var(--color-on-background)',
        outline: 'var(--color-outline)'
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-default)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)'
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
        serif: ['var(--font-serif)'],
        mono: ['var(--font-mono)']
      },
      fontSize: {
        'display-lg': 'var(--type-display-lg)',
        'headline-xl': 'var(--type-headline-xl)',
        'headline-xl-mobile': 'var(--type-headline-xl-mobile)',
        'headline-md': 'var(--type-headline-md)',
        'body-lg': 'var(--type-body-lg)',
        'body-md': 'var(--type-body-md)',
        'label-sm': 'var(--type-label-sm)'
      }
    }
  },
  plugins: []
};
