import MessageThread, { MessagePartner } from './MessageThread';

/**
 * Floating chat panel anchored to the bottom-right corner. Used from profile
 * pages so any user can start a conversation without leaving the page.
 */
export default function MessageDrawer({
  partner,
  currentUserId,
  onClose,
}: {
  partner: MessagePartner;
  currentUserId: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:right-4 sm:w-96">
      <MessageThread
        partner={partner}
        currentUserId={currentUserId}
        onClose={onClose}
        className="h-[26rem] shadow-2xl ring-1 ring-slate-200"
      />
    </div>
  );
}
