/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                evonext: {
                    50: '#f9f0ff',
                    100: '#f2e0fe',
                    200: '#fdbae6',
                    300: '#fc7dd3',
                    400: '#f838bd',
                    500: '#e90ea5',
                    600: '#c70284',
                    700: '#a10369',
                    800: '#850759',
                    900: '#6e0c4a',
                    950: '#49082f',
                },
                neutral: {
                    750: '#323232',
                    850: '#1a1a1a',
                }
            },
            fontFamily: {
                sans: ['system-ui', '-apple-system', 'sans-serif'],
            },
            animation: {
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-down': 'slideDown 0.3s ease-out',
                'fade-in': 'fadeIn 0.2s ease-out',
                'scale-in': 'scaleIn 0.2s ease-out',
                'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideDown: {
                    '0%': { transform: 'translateY(-10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                scaleIn: {
                    '0%': { transform: 'scale(0.95)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.5' },
                }
            },
            backgroundImage: {
                'gradient-evonext': 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                'gradient-dark': 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            },
            boxShadow: {
                'evonext': '0 4px 20px -4px rgba(14, 165, 233, 0.5)',
                'evonext-lg': '0 10px 40px -10px rgba(14, 165, 233, 0.4)',
            }
        },
    },
    plugins: [],
}
