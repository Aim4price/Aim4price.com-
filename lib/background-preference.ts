export const BACKGROUND_PREFERENCE_KEY = 'aim4price-background';

// Default to dark before paint, including when storage is unavailable.
export const BACKGROUND_PREFERENCE_SCRIPT = `(function(){var theme='dark';try{if(localStorage.getItem('${BACKGROUND_PREFERENCE_KEY}')==='light')theme='light';}catch(e){}document.documentElement.dataset.background=theme;})();`;
