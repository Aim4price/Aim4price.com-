import PageLoadingState from '../../../components/PageLoadingState';

export default function DealerMaintenanceLoading() {
  return (
    <PageLoadingState
      label="Loading maintenance"
      detail="Checking the equipment that needs attention first."
    />
  );
}
