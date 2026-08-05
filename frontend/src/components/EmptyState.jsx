import { Inbox } from "lucide-react";

export default function EmptyState({ title = "Nothing here yet", text = "No records match the current view.", action, icon: Icon = Inbox }) {
  return (
    <div className="empty-state" role="status">
      <div className="empty-icon"><Icon size={27} /></div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
