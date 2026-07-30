import PersonIcon from '@mui/icons-material/Person';

export default function AnonymousUserAvatar({ size = 28 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: "#3a3a4a" }}
    >
      <PersonIcon style={{ fontSize: size * 0.6, color: "#9e9eb0" }} />
    </div>
  );
}
