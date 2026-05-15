import Navbar from '../components/Navbar';
import CommunityActivity from '../components/CommunityActivity';

export default function CommunityActivityPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <CommunityActivity />
      </div>
    </div>
  );
}
