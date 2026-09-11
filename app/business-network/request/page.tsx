import RequestView from "./request-client";
export const metadata = {
  title: "Aim4price asset enquiry",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Page() {
  return <RequestView />;
}
