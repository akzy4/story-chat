interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
          ${
            isUser
              ? "bg-indigo-600 text-white rounded-br-sm"
              : "bg-black/8 dark:bg-white/8 rounded-bl-sm"
          }`}
      >
        {message.content}
        {message.streaming && (
          <span className="inline-block w-0.5 h-3.5 ml-0.5 bg-current align-middle animate-pulse" />
        )}
      </div>
    </div>
  );
}

export type { Message };
