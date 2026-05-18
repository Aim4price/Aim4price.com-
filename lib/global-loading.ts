export const GLOBAL_LOADING_START_EVENT = 'aim4price:global-loading-start';
export const GLOBAL_LOADING_STOP_EVENT = 'aim4price:global-loading-stop';

export type GlobalLoadingEventDetail = {
  key?: string;
};

export function setGlobalLoading(isLoading: boolean, key = 'app') {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<GlobalLoadingEventDetail>(
      isLoading ? GLOBAL_LOADING_START_EVENT : GLOBAL_LOADING_STOP_EVENT,
      { detail: { key } },
    ),
  );
}
