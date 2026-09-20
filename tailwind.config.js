/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{html,js,svelte}'],
  theme: {
    extend: {
      colors: { ink: '#17211b', sage: '#557363', cream: '#fbfaf7', clay: '#dc7655' },
      boxShadow: { soft: '0 18px 45px rgba(42, 54, 46, .09)' }
    }
  }
};
