import PageLoadingState from '../../components/PageLoadingState';

export default function TrackingLoading() {
  return (
    <PageLoadingState
      label="Loading maintenance"
      detail="Checking tracked equipment and upcoming work."
    />
  );
}
