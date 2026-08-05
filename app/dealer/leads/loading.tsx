import PageLoadingState from '../../../components/PageLoadingState';
import styles from '../dealer.module.css';

export default function DealerLeadsLoading() {
  return (
    <div className={styles.workspaceLoading}>
      <PageLoadingState
        label="Loading leads"
        detail="Getting your latest Dealer App leads ready."
      />
    </div>
  );
}
