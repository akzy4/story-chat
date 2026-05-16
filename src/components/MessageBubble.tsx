interface ImageAttachment {
  data: string; // base64
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}

interface Message {
  role: "user" | "assistant";
  content: string;
  images?: ImageAttachment[];
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
        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={`data:${img.mediaType};base64,${img.data}`}
                alt={`添付画像 ${i + 1}`}
                className="max-w-[200px] max-h-[200px] rounded-lg object-contain"
              />
            ))}
          </div>
        )}
        {message.content}
        {message.streaming && (
          <span className="inline-block w-0.5 h-3.5 ml-0.5 bg-current align-middle animate-pulse" />
        )}
      </div>
    </div>
  );
}

export type { Message, ImageAttachment };
