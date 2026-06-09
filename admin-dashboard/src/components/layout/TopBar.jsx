import { logout } from '../../firebase/auth';
import { useAuth } from '../../contexts/AuthContext';
import { useBusiness } from '../../hooks/useBusiness';
import { Button } from '../shared/Button';

export default function TopBar() {
  const { user } = useAuth();
  const { businesses, currentBusiness, setCurrentBusiness } = useBusiness();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        {businesses.length > 0 && (
          <select
            value={currentBusiness?.id || ''}
            onChange={(e) => {
              const biz = businesses.find((b) => b.id === e.target.value);
              setCurrentBusiness(biz);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{user?.email}</span>
        <Button variant="ghost" onClick={logout}>Sign Out</Button>
      </div>
    </header>
  );
}
