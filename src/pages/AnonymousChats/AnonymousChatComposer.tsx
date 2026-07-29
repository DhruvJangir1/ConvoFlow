import AnonymousChatInput from "./AnonymousChatInput";

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
    <AnonymousChatInput
      value={value}
      onChange={onChange}
      onSend={onSend}
      isAnonymous={isAnonymous}
      onAnonymousToggle={onAnonymousToggle}
    />
  );
}
