import assetStyles from '../../app/asset-register/page.module.css';
import sharedStyles from '../../app/leads/shared-assets.module.css';
export default function SharedUmbrellaSummary({title,titles,sender,date,expanded,toggle,panelId}:{title:string;titles:string[];sender:string;date:string;expanded:boolean;toggle:()=>void;panelId:string}) {
  return (<section className={sharedStyles.card} data-expanded={expanded}
                        onClick={event => {
                          if (!(event.target as Element).closest('button') && !window.getSelection()?.toString()) toggle();
                        }}>
                        <span className={sharedStyles.icon} aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 12a9 9 0 0 1 18 0c-3-3-6 0-9 0s-6-3-9 0ZM12 3v15a3 3 0 0 0 6 0"/>
                          </svg>
                        </span>
                        <div className={sharedStyles.body}>
                          <div className={sharedStyles.heading}>
                            <h2>{title}</h2>
                            <span className={sharedStyles.count}>{titles.length} {titles.length === 1 ? 'asset' : 'assets'}</span>
                          </div>
                          <div className={sharedStyles.metadata}>
                            <strong>{sender}</strong>
                            <span>Received {date}</span>
                          </div>
                          {!expanded && (
                            <div className={sharedStyles.preview}>
                              {titles.slice(0, 2).map((name,index) => (
                                <span key={index} className={assetStyles.assetGroupPreview} title={name}>{name}</span>
                              ))}
                              {titles.length > 2 && <span className={assetStyles.assetGroupPreview}>+{titles.length - 2} more</span>}
                            </div>
                          )}
                        </div>
                        <button type="button" className={sharedStyles.toggle} onClick={toggle} aria-expanded={expanded} aria-controls={panelId}>
                          <svg className={assetStyles.buttonIcon} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={expanded ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"}/></svg>
                          {expanded ? 'Hide details' : 'View assets'}
                        </button>
                      </section>);
}
