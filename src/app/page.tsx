"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Database, BarChart3 } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: query };
    setMessages((prev) => [...prev, userMessage]);
    setQuery("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage.content }),
      });

      if (!response.ok) {
        throw new Error("API request failed");
      }

      const data = await response.json();
      const assistantMessage: Message = { role: "assistant", content: data.answer };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "エラーが発生しました。接続を確認してください。" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  return (
    <div className="container mx-auto max-w-4xl min-h-screen py-8 px-4 flex flex-col">
      <Card className="flex-1 flex flex-col shadow-lg border-2">
        <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            <CardTitle>AI データ分析エージェント</CardTitle>
          </div>
          <CardDescription className="text-primary-foreground/80">
            BigQuery や GA4 のデータを自然言語で分析します
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 p-0 overflow-hidden relative bg-muted/30">
          <ScrollArea ref={scrollAreaRef} className="h-[calc(100vh-320px)] p-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-2 mt-20">
                <BarChart3 className="w-12 h-12" />
                <p className="text-center px-4">「今日のアクティブユーザー数は？」や「過去7日間のページビュー推移を教えて」など、質問を入力してください。</p>
              </div>
            )}
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-background border border-border text-foreground rounded-bl-none"
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-background border border-border rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2 shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">データを分析中...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="p-4 border-t bg-background rounded-b-lg">
          <form onSubmit={handleSubmit} className="flex w-full gap-2">
            <Input
              placeholder="質問を入力（例: 今日のアクティブユーザーは？）..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 h-12 focus-visible:ring-primary shadow-inner"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading || !query.trim()} className="w-12 h-12">
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </CardFooter>
      </Card>
      
      <p className="text-center text-xs text-muted-foreground mt-4">
        ※ このエージェントは BigQuery (SELECTのみ) と GA4 のデータを参照します。
      </p>
    </div>
  );
}
