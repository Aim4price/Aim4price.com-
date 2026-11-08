export const BACKGROUND_PREFERENCE_KEY = 'aim4price-background';

// Default to light before paint, including when storage is unavailable.
export const BACKGROUND_PREFERENCE_SCRIPT = `(function(){var theme='light';try{if(localStorage.getItem('${BACKGROUND_PREFERENCE_KEY}')==='dark')theme='dark';}catch(e){}document.documentElement.dataset.background=theme;})();`;
