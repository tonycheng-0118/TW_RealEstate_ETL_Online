import ChatBox from "@/app/components/ChatBox";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="border-b bg-white dark:bg-zinc-900 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold">台灣實價登錄 AI 查詢</h1>
          <p className="text-sm text-muted-foreground">
            用自然語言查詢不動產成交資料 · 資料來源：內政部實價登錄
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <ChatBox />
      </main>

      {/* Footer */}
      <footer className="border-t bg-white dark:bg-zinc-900 px-4 py-3 text-center text-xs text-muted-foreground">
        資料來源：
        <a
          href="https://plvr.land.moi.gov.tw/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          內政部不動產交易實價查詢服務網
        </a>
        {" · "}
        本站僅供參考，不構成任何投資建議
      </footer>
    </div>
  );
}
