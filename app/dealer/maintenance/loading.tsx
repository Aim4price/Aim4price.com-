import PageLoadingState from '../../../components/PageLoadingState';
import styles from '../dealer.module.css';

export default function DealerMaintenanceLoading() {
  return (
    <div className={styles.workspaceLoading}>
      <PageLoadingState
        label="Loading maintenance"
        detail="Getting your tracked equipment and maintenance ready."
      />
    </div>
  );
}
