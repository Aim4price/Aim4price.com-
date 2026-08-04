import PageLoadingState from '../../../components/PageLoadingState';

export default function DealerLeadsLoading() {
  return (
    <PageLoadingState
      label="Loading leads"
      detail="Opening the latest dealer requests first."
    />
  );
}
