import { StatusPage } from "@/components/status-page";

export default function NotFound() {
  return (
    <StatusPage
      title="That page is not here"
      body="The listing may be hidden, the shop may be unpublished, or the link is wrong."
    />
  );
}
