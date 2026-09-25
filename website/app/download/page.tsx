import DownloadClient from "./ui";
export const metadata = { title: "Download NotchSignal" };
export default async function DownloadPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return <DownloadClient token={params.token ?? ""} />;
}
