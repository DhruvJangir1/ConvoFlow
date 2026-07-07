import ChatInput from "../../components/ChatInput";

interface AnonymousChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isAnonymous: boolean;
  onAnonymousToggle: () => void;
}

export default function AnonymousChatComposer({
  value,
  onChange,
  onSend,
  isAnonymous,
  onAnonymousToggle,
}: AnonymousChatComposerProps) {
  return (
    <div className="pb-4 pt-2">
      <ChatInput
        value={value}
        onChange={onChange}
        onSend={onSend}
        isAnonymous={isAnonymous}
        onAnonymousToggle={onAnonymousToggle}
      />
    </div>
  );
}
