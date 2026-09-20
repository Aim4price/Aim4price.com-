const root = '/' + location.pathname.split('/')[1];
export const app = ({ '/owner-app': 'owner', '/field-manager': 'field', '/dealer': 'dealer', '/middleman': 'middleman' })[root];
if (!app) throw Error('Open offline work from an Aim4price app.');
export const config = { root, app, label: ({ owner: 'Owner', field: 'Field Manager', dealer: 'Dealer', middleman: 'Middleman' })[app],
  worker: ({ owner: '/owner-app-sw.js', field: '/field-manager-sw.js', dealer: '/dealer-sw.js', middleman: '/middleman-sw.js' })[app],
  api: '/api/app-offline/' + app, cache: 'aim4price-' + app + '-offline-shell-v5',
  channel: 'aim4price-' + (app === 'field' ? 'field' : app) + '-session' };
