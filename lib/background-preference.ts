export const BACKGROUND_PREFERENCE_KEY = 'aim4price-background';

// Apply the saved background before the page paints. Storage may be blocked.
export const BACKGROUND_PREFERENCE_SCRIPT = `(function(){try{if(localStorage.getItem('${BACKGROUND_PREFERENCE_KEY}')==='dark'){document.documentElement.dataset.background='dark';}}catch(e){}})();`;
