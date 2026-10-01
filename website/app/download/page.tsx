import DownloadClient from "./ui";

export const metadata = { title: "Download NotchSignal" };

export default async function DownloadPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; session_id?: string; status?: string }>;
}) {
  const params = await searchParams;
  return (
    <DownloadClient
      token={params.token ?? ""}
      sessionId={params.session_id ?? ""}
      checkoutStatus={params.status ?? ""}
    />
  );
}
